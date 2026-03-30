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
  positiveVotes?: number;
  negativeVotes?: number;
  positiveRatio?: number;
  saveCount?: number;
}

export type LeaderboardReaction = 'fire' | 'shit';

@Injectable()
export class LeaderboardService {
  private readonly reactionMigrationErrorMessage =
    'Negative reactions are temporarily unavailable because the reaction migration is missing. Please apply database migration 047_leaderboard_reactions_and_temperature.';

  private isMissingLeaderboardReactionColumn(error: unknown): boolean {
    const maybeError = error as { code?: string; message?: string } | null;
    const message = (maybeError?.message ?? '').toLowerCase();
    return (
      (maybeError?.code === '42703' && message.includes('reaction')) ||
      (maybeError?.code === 'PGRST204' && message.includes('reaction'))
    );
  }

  private async refreshSongTemperatureCache(songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const result = await supabase.rpc('refresh_song_temperature', {
      p_song_id: songId,
    });
    if (result.error) {
      const message = (result.error.message ?? '').toLowerCase();
      const missingFunction =
        result.error.code === '42883' ||
        (result.error.code === 'PGRST202' &&
          message.includes('refresh_song_temperature'));
      const missingTable =
        result.error.code === '42P01' ||
        (result.error.code === 'PGRST205' &&
          message.includes('song_temperature'));
      if (!missingFunction && !missingTable) {
        throw new Error(
          `Failed to refresh song temperature cache: ${result.error.message}`,
        );
      }
    }
  }

  private async maybeEmitRisingStarForPlay(
    playId: string,
    songId: string,
  ): Promise<void> {
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
   * Songs ordered by saved-count from analytics (likes table).
   */
  async getSongsByLikes(
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const songs = await this.getApprovedSongsBase();
    const songIds = songs.map((song) => song.id);
    const { saveCounts, playCounts, profileListenCounts } =
      await this.getEngagementCountsBySongId(songIds);

    const ranked = songs
      .map((song) => {
        const playCount = playCounts.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount =
          profileListenCounts.get(song.id) ?? song.profile_play_count ?? 0;
        const saveCount = saveCounts.get(song.id) ?? song.like_count ?? 0;
        return {
          id: song.id,
          title: song.title,
          artistName: song.artist_name,
          artistId: song.artist_id,
          artworkUrl: song.artwork_url,
          likeCount: saveCount,
          saveCount,
          playCount,
          profilePlayCount,
          totalListenCount: playCount + profilePlayCount,
        } satisfies LeaderboardSong;
      })
      .sort(
        (a, b) =>
          (b.saveCount ?? 0) - (a.saveCount ?? 0) ||
          (b.totalListenCount ?? 0) - (a.totalListenCount ?? 0) ||
          (b.playCount ?? 0) - (a.playCount ?? 0),
      );

    return ranked.slice(offset, offset + limit);
  }

  /**
   * Songs ordered by combined listens: radio plays + profile listens.
   */
  async getSongsByListens(
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const songs = await this.getApprovedSongsBase();
    const songIds = songs.map((song) => song.id);
    const { saveCounts, playCounts, profileListenCounts } =
      await this.getEngagementCountsBySongId(songIds);

    const ranked = songs
      .map((song) => {
        const playCount = playCounts.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount =
          profileListenCounts.get(song.id) ?? song.profile_play_count ?? 0;
        const saveCount = saveCounts.get(song.id) ?? song.like_count ?? 0;
        return {
          id: song.id,
          title: song.title,
          artistName: song.artist_name,
          artistId: song.artist_id,
          artworkUrl: song.artwork_url,
          likeCount: saveCount,
          saveCount,
          playCount,
          profilePlayCount,
          totalListenCount: playCount + profilePlayCount,
          spotlightListenCount: song.spotlight_listen_count ?? 0,
        } satisfies LeaderboardSong;
      })
      .sort(
        (a, b) =>
          (b.totalListenCount ?? 0) - (a.totalListenCount ?? 0) ||
          (b.playCount ?? 0) - (a.playCount ?? 0) ||
          (b.saveCount ?? 0) - (a.saveCount ?? 0),
      );
    return ranked.slice(offset, offset + limit);
  }

  /**
   * Trial by Fire: songs ranked by upvotes/minute over a recent window.
   * Uses leaderboard_likes + plays within the window and computes:
   * upvotesPerMinute = likesInWindow / windowMinutes
   */
  async getSongsByUpvotesPerMinute(
    windowMinutes: number,
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const safeWindow = Math.min(Math.max(1, windowMinutes || 60), 24 * 60);
    const startIso = new Date(
      Date.now() - safeWindow * 60 * 1000,
    ).toISOString();

    const [playsRes, likesRes] = await Promise.all([
      supabase.from('plays').select('song_id').gte('played_at', startIso),
      supabase
        .from('leaderboard_likes')
        .select('song_id')
        .gte('created_at', startIso),
    ]);

    const plays = (playsRes.data ?? []) as Array<{ song_id: string }>;
    const likes = (likesRes.data ?? []) as Array<{ song_id: string }>;

    const playsBySong: Record<string, number> = {};
    for (const p of plays)
      playsBySong[p.song_id] = (playsBySong[p.song_id] || 0) + 1;

    const likesBySong: Record<string, number> = {};
    for (const l of likes)
      likesBySong[l.song_id] = (likesBySong[l.song_id] || 0) + 1;

    const allSongIds = Array.from(
      new Set([...Object.keys(playsBySong), ...Object.keys(likesBySong)]),
    );
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
      .sort(
        (a, b) =>
          b.upvotesPerMinute - a.upvotesPerMinute ||
          b.likesInWindow - a.likesInWindow ||
          b.playsInWindow - a.playsInWindow,
      )
      .slice(offset, offset + limit);

    const selectedIds = rankedSongIds.map((r) => r.id);
    const { data: songs } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, play_count')
      .in('id', selectedIds)
      .eq('status', 'approved');

    const statsById = new Map(rankedSongIds.map((r) => [r.id, r]));
    const order = new Map(selectedIds.map((id, i) => [id, i]));
    const sorted = (songs ?? []).sort(
      (a: any, b: any) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
    );

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

  private async getApprovedSongsBase(): Promise<
    Array<{
      id: string;
      title: string;
      artist_name: string;
      artist_id: string;
      artwork_url: string | null;
      play_count: number | null;
      profile_play_count: number | null;
      like_count: number | null;
      spotlight_listen_count: number | null;
    }>
  > {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('songs')
      .select(
        'id, title, artist_name, artist_id, artwork_url, play_count, profile_play_count, like_count, spotlight_listen_count',
      )
      .eq('status', 'approved');
    if (error) {
      throw new Error(`Failed to fetch leaderboard songs: ${error.message}`);
    }
    return (data ?? []) as Array<{
      id: string;
      title: string;
      artist_name: string;
      artist_id: string;
      artwork_url: string | null;
      play_count: number | null;
      profile_play_count: number | null;
      like_count: number | null;
      spotlight_listen_count: number | null;
    }>;
  }

  private async getReactionStatsBySongId(
    songIds?: string[],
  ): Promise<
    Map<string, { fireVotes: number; shitVotes: number; totalVotes: number }>
  > {
    const supabase = getSupabaseClient();
    const stats = new Map<
      string,
      { fireVotes: number; shitVotes: number; totalVotes: number }
    >();

    let songTemperatureQuery = supabase
      .from('song_temperature')
      .select('song_id, fire_votes, shit_votes, total_votes');
    if (songIds != null && songIds.length > 0) {
      songTemperatureQuery = songTemperatureQuery.in('song_id', songIds);
    }
    const songTemperatureRes = await songTemperatureQuery;
    if (!songTemperatureRes.error && songTemperatureRes.data) {
      for (const row of songTemperatureRes.data as Array<{
        song_id: string;
        fire_votes: number | null;
        shit_votes: number | null;
        total_votes: number | null;
      }>) {
        const fireVotes = Math.max(0, Number(row.fire_votes ?? 0) || 0);
        const shitVotes = Math.max(0, Number(row.shit_votes ?? 0) || 0);
        const totalVotes = Math.max(
          0,
          Number(row.total_votes ?? fireVotes + shitVotes) || 0,
        );
        stats.set(row.song_id, {
          fireVotes,
          shitVotes,
          totalVotes: totalVotes || fireVotes + shitVotes,
        });
      }
      return stats;
    }

    let reactionQuery = supabase
      .from('leaderboard_likes')
      .select('song_id, reaction');
    if (songIds != null && songIds.length > 0) {
      reactionQuery = reactionQuery.in('song_id', songIds);
    }
    const { data: rows, error } = await reactionQuery;
    if (error) {
      throw new Error(`Failed to fetch reaction stats: ${error.message}`);
    }
    for (const row of (rows ?? []) as Array<{
      song_id: string;
      reaction: LeaderboardReaction | null;
    }>) {
      const current = stats.get(row.song_id) ?? {
        fireVotes: 0,
        shitVotes: 0,
        totalVotes: 0,
      };
      if (row.reaction === 'shit') {
        current.shitVotes += 1;
      } else {
        current.fireVotes += 1;
      }
      current.totalVotes += 1;
      stats.set(row.song_id, current);
    }
    return stats;
  }

  private async getSaveCountsBySongId(
    songIds: string[],
  ): Promise<Map<string, number>> {
    const supabase = getSupabaseClient();
    const counts = new Map<string, number>();
    if (songIds.length === 0) return counts;
    const { data, error } = await supabase
      .from('likes')
      .select('song_id')
      .in('song_id', songIds);
    if (error) {
      throw new Error(`Failed to fetch save stats: ${error.message}`);
    }
    for (const row of (data ?? []) as Array<{ song_id: string }>) {
      counts.set(row.song_id, (counts.get(row.song_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getPlayCountsBySongId(
    songIds: string[],
  ): Promise<Map<string, number>> {
    const supabase = getSupabaseClient();
    const counts = new Map<string, number>();
    if (songIds.length === 0) return counts;
    const { data, error } = await supabase
      .from('plays')
      .select('song_id')
      .in('song_id', songIds);
    if (error) {
      throw new Error(`Failed to fetch play stats: ${error.message}`);
    }
    for (const row of (data ?? []) as Array<{ song_id: string }>) {
      counts.set(row.song_id, (counts.get(row.song_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getProfileListenCountsBySongId(
    songIds: string[],
  ): Promise<Map<string, number>> {
    const supabase = getSupabaseClient();
    const counts = new Map<string, number>();
    if (songIds.length === 0) return counts;
    const { data, error } = await supabase
      .from('song_profile_listens')
      .select('song_id')
      .in('song_id', songIds);
    if (error) {
      const message = (error.message ?? '').toLowerCase();
      const missingTable =
        error.code === '42P01' ||
        (error.code === 'PGRST205' && message.includes('song_profile_listens'));
      if (!missingTable) {
        throw new Error(
          `Failed to fetch profile-listen stats: ${error.message}`,
        );
      }
      return counts;
    }
    for (const row of (data ?? []) as Array<{ song_id: string }>) {
      counts.set(row.song_id, (counts.get(row.song_id) ?? 0) + 1);
    }
    return counts;
  }

  private async getEngagementCountsBySongId(songIds: string[]): Promise<{
    saveCounts: Map<string, number>;
    playCounts: Map<string, number>;
    profileListenCounts: Map<string, number>;
  }> {
    const [saveCounts, playCounts, profileListenCounts] = await Promise.all([
      this.getSaveCountsBySongId(songIds),
      this.getPlayCountsBySongId(songIds),
      this.getProfileListenCountsBySongId(songIds),
    ]);
    return { saveCounts, playCounts, profileListenCounts };
  }

  async getSongsByPositiveVotes(
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const songs = await this.getApprovedSongsBase();
    const songIds = songs.map((song) => song.id);
    const [reactionStats, { saveCounts, playCounts, profileListenCounts }] =
      await Promise.all([
        this.getReactionStatsBySongId(songIds),
        this.getEngagementCountsBySongId(songIds),
      ]);

    const ranked = songs
      .map((song) => {
        const stats = reactionStats.get(song.id) ?? {
          fireVotes: 0,
          shitVotes: 0,
          totalVotes: 0,
        };
        const positiveRatio =
          stats.totalVotes > 0 ? stats.fireVotes / stats.totalVotes : 0;
        const playCount = playCounts.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount =
          profileListenCounts.get(song.id) ?? song.profile_play_count ?? 0;
        return {
          id: song.id,
          title: song.title,
          artistName: song.artist_name,
          artistId: song.artist_id,
          artworkUrl: song.artwork_url,
          playCount,
          profilePlayCount,
          totalListenCount: playCount + profilePlayCount,
          likeCount: saveCounts.get(song.id) ?? song.like_count ?? 0,
          saveCount: saveCounts.get(song.id) ?? song.like_count ?? 0,
          positiveVotes: stats.fireVotes,
          negativeVotes: stats.shitVotes,
          positiveRatio: Number(positiveRatio.toFixed(4)),
        } satisfies LeaderboardSong;
      })
      .sort(
        (a, b) =>
          (b.positiveVotes ?? 0) - (a.positiveVotes ?? 0) ||
          (b.positiveRatio ?? 0) - (a.positiveRatio ?? 0) ||
          (b.saveCount ?? 0) - (a.saveCount ?? 0),
      );

    return ranked.slice(offset, offset + limit);
  }

  async getSongsByLikeDislikeRatio(
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const songs = await this.getApprovedSongsBase();
    const songIds = songs.map((song) => song.id);
    const [reactionStats, { saveCounts, playCounts, profileListenCounts }] =
      await Promise.all([
        this.getReactionStatsBySongId(songIds),
        this.getEngagementCountsBySongId(songIds),
      ]);

    const ranked = songs
      .map((song) => {
        const stats = reactionStats.get(song.id) ?? {
          fireVotes: 0,
          shitVotes: 0,
          totalVotes: 0,
        };
        const positiveRatio =
          stats.totalVotes > 0 ? stats.fireVotes / stats.totalVotes : 0;
        const playCount = playCounts.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount =
          profileListenCounts.get(song.id) ?? song.profile_play_count ?? 0;
        return {
          id: song.id,
          title: song.title,
          artistName: song.artist_name,
          artistId: song.artist_id,
          artworkUrl: song.artwork_url,
          playCount,
          profilePlayCount,
          totalListenCount: playCount + profilePlayCount,
          likeCount: saveCounts.get(song.id) ?? song.like_count ?? 0,
          saveCount: saveCounts.get(song.id) ?? song.like_count ?? 0,
          positiveVotes: stats.fireVotes,
          negativeVotes: stats.shitVotes,
          positiveRatio: Number(positiveRatio.toFixed(4)),
        } satisfies LeaderboardSong;
      })
      .sort(
        (a, b) =>
          (b.positiveRatio ?? 0) - (a.positiveRatio ?? 0) ||
          (b.positiveVotes ?? 0) - (a.positiveVotes ?? 0) ||
          (b.saveCount ?? 0) - (a.saveCount ?? 0),
      );

    return ranked.slice(offset, offset + limit);
  }

  async getSongsBySaves(
    limit: number,
    offset: number,
  ): Promise<LeaderboardSong[]> {
    const songs = await this.getApprovedSongsBase();
    const songIds = songs.map((song) => song.id);
    const [reactionStats, { saveCounts, playCounts, profileListenCounts }] =
      await Promise.all([
        this.getReactionStatsBySongId(songIds),
        this.getEngagementCountsBySongId(songIds),
      ]);

    const ranked = songs
      .map((song) => {
        const stats = reactionStats.get(song.id) ?? {
          fireVotes: 0,
          shitVotes: 0,
          totalVotes: 0,
        };
        const positiveRatio =
          stats.totalVotes > 0 ? stats.fireVotes / stats.totalVotes : 0;
        const playCount = playCounts.get(song.id) ?? song.play_count ?? 0;
        const profilePlayCount =
          profileListenCounts.get(song.id) ?? song.profile_play_count ?? 0;
        const saveCount = saveCounts.get(song.id) ?? song.like_count ?? 0;
        return {
          id: song.id,
          title: song.title,
          artistName: song.artist_name,
          artistId: song.artist_id,
          artworkUrl: song.artwork_url,
          playCount,
          profilePlayCount,
          totalListenCount: playCount + profilePlayCount,
          likeCount: saveCount,
          saveCount,
          positiveVotes: stats.fireVotes,
          negativeVotes: stats.shitVotes,
          positiveRatio: Number(positiveRatio.toFixed(4)),
        } satisfies LeaderboardSong;
      })
      .sort(
        (a, b) =>
          (b.saveCount ?? 0) - (a.saveCount ?? 0) ||
          (b.positiveVotes ?? 0) - (a.positiveVotes ?? 0) ||
          (b.positiveRatio ?? 0) - (a.positiveRatio ?? 0),
      );

    return ranked.slice(offset, offset + limit);
  }

  /**
   * Record a leaderboard like (one per user per play). Idempotent if same user + play_id.
   */
  async addLeaderboardLike(
    userId: string,
    songId: string,
    playId: string | null,
    reaction: LeaderboardReaction = 'fire',
  ): Promise<{
    liked: boolean;
    reaction: LeaderboardReaction | null;
    previousReaction: LeaderboardReaction | null;
  }> {
    const supabase = getSupabaseClient();
    const safeReaction: LeaderboardReaction =
      reaction === 'shit' ? 'shit' : 'fire';
    const ensureSongLiked = async () => {
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', userId)
        .eq('song_id', songId)
        .maybeSingle();
      if (!existingLike) {
        const { error: likeError } = await supabase.from('likes').insert({
          user_id: userId,
          song_id: songId,
        });
        if (likeError && likeError.code !== '23505') {
          throw new Error(
            `Failed to save song to library: ${likeError.message}`,
          );
        }
      }
    };

    if (playId) {
      let existing:
        | { id: string; reaction?: LeaderboardReaction | null }
        | null
        | undefined = null;
      const existingRes = await supabase
        .from('leaderboard_likes')
        .select('id, reaction')
        .eq('user_id', userId)
        .eq('play_id', playId)
        .single();
      if (
        existingRes.error &&
        this.isMissingLeaderboardReactionColumn(existingRes.error)
      ) {
        if (safeReaction === 'shit') {
          throw new Error(this.reactionMigrationErrorMessage);
        }
        const legacyExistingRes = await supabase
          .from('leaderboard_likes')
          .select('id')
          .eq('user_id', userId)
          .eq('play_id', playId)
          .single();
        existing = legacyExistingRes.data
          ? ({ id: (legacyExistingRes.data as { id: string }).id } as {
              id: string;
              reaction?: LeaderboardReaction | null;
            })
          : null;
      } else {
        existing = existingRes.data as
          | { id: string; reaction?: LeaderboardReaction | null }
          | null
          | undefined;
      }
      if (existing) {
        const existingReaction =
          (existing as { reaction?: LeaderboardReaction | null }).reaction ??
          'fire';
        if (existingReaction === safeReaction) {
          const { error: deleteError } = await supabase
            .from('leaderboard_likes')
            .delete()
            .eq('id', (existing as { id: string }).id);
          if (deleteError) {
            throw new Error(
              `Failed to remove leaderboard reaction: ${deleteError.message}`,
            );
          }
          await this.refreshSongTemperatureCache(songId);
          return {
            liked: false,
            reaction: null,
            previousReaction: existingReaction,
          };
        }
        const { error: updateError } = await supabase
          .from('leaderboard_likes')
          .update({ reaction: safeReaction })
          .eq('id', (existing as { id: string }).id);
        if (
          updateError &&
          this.isMissingLeaderboardReactionColumn(updateError)
        ) {
          if (safeReaction === 'shit') {
            throw new Error(this.reactionMigrationErrorMessage);
          }
          // Legacy schema has no reaction column; keep existing vote.
        } else if (updateError) {
          throw new Error(
            `Failed to update leaderboard reaction: ${updateError.message}`,
          );
        }
        if (safeReaction === 'fire') {
          await ensureSongLiked();
        }
        await this.refreshSongTemperatureCache(songId);
        return {
          liked: true,
          reaction: safeReaction,
          previousReaction: existingReaction,
        };
      }
    } else {
      let existingSongVote:
        | { id: string; reaction?: LeaderboardReaction | null }
        | null
        | undefined = null;
      const existingSongVoteRes = await supabase
        .from('leaderboard_likes')
        .select('id, reaction')
        .eq('user_id', userId)
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        existingSongVoteRes.error &&
        this.isMissingLeaderboardReactionColumn(existingSongVoteRes.error)
      ) {
        if (safeReaction === 'shit') {
          throw new Error(this.reactionMigrationErrorMessage);
        }
        const legacySongVoteRes = await supabase
          .from('leaderboard_likes')
          .select('id')
          .eq('user_id', userId)
          .eq('song_id', songId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        existingSongVote = legacySongVoteRes.data
          ? ({ id: (legacySongVoteRes.data as { id: string }).id } as {
              id: string;
              reaction?: LeaderboardReaction | null;
            })
          : null;
      } else {
        existingSongVote = existingSongVoteRes.data as
          | { id: string; reaction?: LeaderboardReaction | null }
          | null
          | undefined;
      }
      if (existingSongVote) {
        const existingReaction =
          (existingSongVote as { reaction?: LeaderboardReaction | null })
            .reaction ?? 'fire';
        if (existingReaction === safeReaction) {
          const { error: deleteError } = await supabase
            .from('leaderboard_likes')
            .delete()
            .eq('id', (existingSongVote as { id: string }).id);
          if (deleteError) {
            throw new Error(
              `Failed to remove leaderboard reaction: ${deleteError.message}`,
            );
          }
          await this.refreshSongTemperatureCache(songId);
          return {
            liked: false,
            reaction: null,
            previousReaction: existingReaction,
          };
        }
        const { error: updateError } = await supabase
          .from('leaderboard_likes')
          .update({ reaction: safeReaction })
          .eq('id', (existingSongVote as { id: string }).id);
        if (
          updateError &&
          this.isMissingLeaderboardReactionColumn(updateError)
        ) {
          if (safeReaction === 'shit') {
            throw new Error(this.reactionMigrationErrorMessage);
          }
          // Legacy schema has no reaction column; keep existing vote.
        } else if (updateError) {
          throw new Error(
            `Failed to update leaderboard reaction: ${updateError.message}`,
          );
        }
        if (safeReaction === 'fire') {
          await ensureSongLiked();
        }
        await this.refreshSongTemperatureCache(songId);
        return {
          liked: true,
          reaction: safeReaction,
          previousReaction: existingReaction,
        };
      }
    }

    const { error } = await supabase.from('leaderboard_likes').insert({
      user_id: userId,
      song_id: songId,
      play_id: playId,
      reaction: safeReaction,
    });
    if (error) {
      if (this.isMissingLeaderboardReactionColumn(error)) {
        if (safeReaction === 'shit') {
          throw new Error(this.reactionMigrationErrorMessage);
        }
        // Backward-compatible fallback for environments missing the reaction column.
        const { error: legacyInsertError } = await supabase
          .from('leaderboard_likes')
          .insert({
            user_id: userId,
            song_id: songId,
            play_id: playId,
          });
        if (legacyInsertError) {
          if (legacyInsertError.code === '23505') {
            let existingReaction: LeaderboardReaction = safeReaction;
            if (playId) {
              const existingLegacyVoteRes = await supabase
                .from('leaderboard_likes')
                .select('reaction')
                .eq('user_id', userId)
                .eq('play_id', playId)
                .maybeSingle();
              if (
                existingLegacyVoteRes.error &&
                this.isMissingLeaderboardReactionColumn(
                  existingLegacyVoteRes.error,
                )
              ) {
                existingReaction = 'fire';
              } else if (
                existingLegacyVoteRes.data &&
                (
                  existingLegacyVoteRes.data as {
                    reaction?: LeaderboardReaction | null;
                  }
                ).reaction === 'shit'
              ) {
                existingReaction = 'shit';
              } else {
                existingReaction = 'fire';
              }
            }
            await this.refreshSongTemperatureCache(songId);
            return {
              liked: true,
              reaction: existingReaction,
              previousReaction: existingReaction,
            };
          }
          throw new Error(
            `Failed to record leaderboard like: ${legacyInsertError.message}`,
          );
        }
      } else if (error.code === '23505') {
        let existingReaction: LeaderboardReaction = safeReaction;
        if (playId) {
          const existingVoteRes = await supabase
            .from('leaderboard_likes')
            .select('reaction')
            .eq('user_id', userId)
            .eq('play_id', playId)
            .maybeSingle();
          if (
            existingVoteRes.error &&
            this.isMissingLeaderboardReactionColumn(existingVoteRes.error)
          ) {
            existingReaction = 'fire';
          } else if (
            existingVoteRes.data &&
            (existingVoteRes.data as { reaction?: LeaderboardReaction | null })
              .reaction === 'shit'
          ) {
            existingReaction = 'shit';
          } else {
            existingReaction = 'fire';
          }
        }
        await this.refreshSongTemperatureCache(songId);
        return {
          liked: true,
          reaction: existingReaction,
          previousReaction: existingReaction,
        };
      } else {
        throw new Error(`Failed to record leaderboard like: ${error.message}`);
      }
    }

    // Persist positive sentiment into the user's saved song library.
    if (safeReaction === 'fire') {
      await ensureSongLiked();
    }

    if (playId) {
      // Best-effort Rising Star: only emits once per play due to unique index.
      void this.maybeEmitRisingStarForPlay(playId, songId);
    }
    await this.refreshSongTemperatureCache(songId);
    return { liked: true, reaction: safeReaction, previousReaction: null };
  }
}
