import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface LeaderboardSong {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  likeCount?: number;
  playCount?: number;
  profilePlayCount?: number;
  totalListenCount?: number;
  spotlightListenCount?: number;
  // Trial by Fire (windowed)
  windowMinutes?: number;
  likesInWindow?: number;
  playsInWindow?: number;
  upvotesPerMinute?: number;
}

@Injectable()
export class LeaderboardService {
  private async maybeEmitRisingStarForPlay(playId: string, songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      const { data: play } = await supabase
        .from('plays')
        .select('id, listener_count, played_at')
        .eq('id', playId)
        .single();
      if (!play?.id || !play.played_at) return;

      const listenersAtStart = (play as any).listener_count ?? 0;
      if (listenersAtStart <= 0) return;

      const startedAtIso = (play as any).played_at as string;
      const { count: votesDuring } = await supabase
        .from('leaderboard_likes')
        .select('*', { count: 'exact', head: true })
        .eq('play_id', playId);

      const votes = votesDuring ?? 0;
      const conversion = votes / listenersAtStart;
      if (conversion < 0.05) return;

      const { data: song } = await supabase
        .from('songs')
        .select('title, artist_name, artist_id')
        .eq('id', songId)
        .single();

      const payload = {
        type: 'rising_star',
        songId,
        playId,
        songTitle: (song as any)?.title ?? 'A song',
        artistId: (song as any)?.artist_id ?? null,
        artistName: (song as any)?.artist_name ?? 'An artist',
        votesDuring: votes,
        listenersAtStart,
        conversion,
        startedAt: startedAtIso,
      };

      const { error } = await supabase.from('station_events').insert({
        station_id: 'global',
        type: 'rising_star',
        play_id: playId,
        song_id: songId,
        payload,
      });
      if (error) {
        if (error.code === '23505') return;
      }
    } catch {
      return;
    }
  }

  /**
   * Songs ordered by persistent like count (profile likes).
   */
  async getSongsByLikes(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count, profile_play_count, like_count')
      .eq('status', 'approved')
      .order('like_count', { ascending: false, nullsFirst: false })
      .order('play_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch likes leaderboard: ${error.message}`);
    return (songs || []).map((s: any) => {
      const playCount = s.play_count ?? 0;
      const profilePlayCount = s.profile_play_count ?? 0;
      return {
        id: s.id,
        title: s.title,
        artistName: s.artist_name,
        artistId: s.artist_id,
        artworkUrl: s.artwork_url,
        likeCount: s.like_count ?? 0,
        playCount,
        profilePlayCount,
        totalListenCount: playCount + profilePlayCount,
      } satisfies LeaderboardSong;
    });
  }

  /**
   * Songs ordered by combined listens: radio plays + profile listens.
   */
  async getSongsByListens(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count, profile_play_count, spotlight_listen_count, like_count')
      .eq('status', 'approved')
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch listens leaderboard: ${error.message}`);
    const withTotals = (songs || []).map((s: any) => {
      const playCount = s.play_count ?? 0;
      const profilePlayCount = s.profile_play_count ?? 0;
      return {
        id: s.id,
        title: s.title,
        artistName: s.artist_name,
        artistId: s.artist_id,
        artworkUrl: s.artwork_url,
        likeCount: s.like_count ?? 0,
        playCount,
        profilePlayCount,
        totalListenCount: playCount + profilePlayCount,
        spotlightListenCount: s.spotlight_listen_count ?? 0,
      } satisfies LeaderboardSong;
    });
    withTotals.sort((a, b) => (b.totalListenCount ?? 0) - (a.totalListenCount ?? 0) || (b.playCount ?? 0) - (a.playCount ?? 0));
    return withTotals.slice(0, limit);
  }

  /**
   * Trial by Fire: songs ranked by upvotes/minute over a recent window.
   * Uses leaderboard_likes + plays within the window and computes:
   * upvotesPerMinute = likesInWindow / windowMinutes
   */
  async getSongsByUpvotesPerMinute(windowMinutes: number, limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const safeWindow = Math.min(Math.max(1, windowMinutes || 60), 24 * 60);
    const startIso = new Date(Date.now() - safeWindow * 60 * 1000).toISOString();

    const [playsRes, likesRes] = await Promise.all([
      supabase
        .from('plays')
        .select('song_id')
        .gte('played_at', startIso),
      supabase
        .from('leaderboard_likes')
        .select('song_id')
        .gte('created_at', startIso),
    ]);

    const plays = (playsRes.data ?? []) as Array<{ song_id: string }>;
    const likes = (likesRes.data ?? []) as Array<{ song_id: string }>;

    const playsBySong: Record<string, number> = {};
    for (const p of plays) playsBySong[p.song_id] = (playsBySong[p.song_id] || 0) + 1;

    const likesBySong: Record<string, number> = {};
    for (const l of likes) likesBySong[l.song_id] = (likesBySong[l.song_id] || 0) + 1;

    const allSongIds = Array.from(new Set([...Object.keys(playsBySong), ...Object.keys(likesBySong)]));
    if (allSongIds.length === 0) {
      // Fallback: nothing in the window yet.
      return this.getSongsByLikes(limit, offset);
    }

    const rankedSongIds = allSongIds
      .map((id) => {
        const likesInWindow = likesBySong[id] ?? 0;
        const playsInWindow = playsBySong[id] ?? 0;
        return {
          id,
          likesInWindow,
          playsInWindow,
          upvotesPerMinute: likesInWindow / safeWindow,
        };
      })
      .sort((a, b) => b.upvotesPerMinute - a.upvotesPerMinute || b.likesInWindow - a.likesInWindow || b.playsInWindow - a.playsInWindow)
      .slice(offset, offset + limit);

    const selectedIds = rankedSongIds.map((r) => r.id);
    const { data: songs } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count')
      .in('id', selectedIds)
      .eq('status', 'approved');

    const statsById = new Map(rankedSongIds.map((r) => [r.id, r]));
    const order = new Map(selectedIds.map((id, i) => [id, i]));
    const sorted = (songs ?? []).sort((a: any, b: any) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

    return sorted.map((s: any) => {
      const st = statsById.get(s.id);
      return {
        id: s.id,
        title: s.title,
        artistName: s.artist_name,
        artistId: s.artist_id,
        artworkUrl: s.artwork_url,
        playCount: s.play_count ?? 0,
        windowMinutes: safeWindow,
        likesInWindow: st?.likesInWindow ?? 0,
        playsInWindow: st?.playsInWindow ?? 0,
        upvotesPerMinute: st?.upvotesPerMinute ?? 0,
      } satisfies LeaderboardSong;
    });
  }

  /**
   * Record a leaderboard like (one per user per play). Idempotent if same user + play_id.
   */
  async addLeaderboardLike(userId: string, songId: string, playId: string | null): Promise<{ liked: boolean }> {
    const supabase = getSupabaseClient();
    if (playId) {
      const { data: existing } = await supabase
        .from('leaderboard_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('play_id', playId)
        .single();
      if (existing) return { liked: true };
    }

    const { error } = await supabase.from('leaderboard_likes').insert({
      user_id: userId,
      song_id: songId,
      play_id: playId,
    });
    if (error) {
      if (error.code === '23505') return { liked: true };
      throw new Error(`Failed to record leaderboard like: ${error.message}`);
    }

    if (playId) {
      // Best-effort Rising Star: only emits once per play due to unique index.
      void this.maybeEmitRisingStarForPlay(playId, songId);
    }
    return { liked: true };
  }
}
