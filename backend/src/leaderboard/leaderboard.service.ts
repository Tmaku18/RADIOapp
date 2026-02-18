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
  spotlightListenCount?: number;
  // Trial by Fire (windowed)
  windowMinutes?: number;
  likesInWindow?: number;
  playsInWindow?: number;
  upvotesPerMinute?: number;
}

@Injectable()
export class LeaderboardService {
  /**
   * Songs ordered by leaderboard like count (from leaderboard_likes table).
   */
  async getSongsByLikes(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: countRows } = await supabase
      .from('leaderboard_likes')
      .select('song_id');
    const countBySong: Record<string, number> = {};
    countRows?.forEach((r: { song_id: string }) => {
      countBySong[r.song_id] = (countBySong[r.song_id] || 0) + 1;
    });
    const songIds = Object.entries(countBySong)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(offset, offset + limit);

    if (songIds.length === 0 && offset === 0) {
      const { data: anySongs } = await supabase
        .from('songs')
        .select('id, title, artist_name, artist_id, artwork_url, play_count')
        .eq('status', 'approved')
        .order('play_count', { ascending: false, nullsFirst: false })
        .range(0, limit - 1);
      return (anySongs || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        artistName: s.artist_name,
        artistId: s.artist_id,
        artworkUrl: s.artwork_url,
        likeCount: 0,
        playCount: s.play_count ?? 0,
      }));
    }

    if (songIds.length === 0) return [];

    const { data: songs } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count')
      .in('id', songIds)
      .eq('status', 'approved');

    const order = new Map(songIds.map((id, i) => [id, i]));
    const sorted = (songs || []).sort((a: any, b: any) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    return sorted.map((s: any) => ({
      id: s.id,
      title: s.title,
      artistName: s.artist_name,
      artistId: s.artist_id,
      artworkUrl: s.artwork_url,
      likeCount: countBySong[s.id] ?? 0,
      playCount: s.play_count ?? 0,
    }));
  }

  /**
   * Songs ordered by play_count (radio plays). Returns actual stats for the leaderboard.
   */
  async getSongsByListens(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count, spotlight_listen_count')
      .eq('status', 'approved')
      .order('play_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch listens leaderboard: ${error.message}`);
    return (songs || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      artistName: s.artist_name,
      artistId: s.artist_id,
      artworkUrl: s.artwork_url,
      playCount: s.play_count ?? 0,
      spotlightListenCount: s.spotlight_listen_count ?? 0,
    }));
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
    return { liked: true };
  }
}
