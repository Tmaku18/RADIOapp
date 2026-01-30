import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

// Default song duration if not specified (3 minutes in seconds)
const DEFAULT_DURATION_SECONDS = 180;

interface QueueStateRow {
  song_id: string;
  played_at: string;
  position?: number;
  [key: string]: unknown;
}

interface SongRow {
  id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  artwork_url?: string | null;
  duration_seconds?: number | null;
  credits_remaining?: number | null;
  play_count?: number | null;
  last_played_at?: string | null;
  [key: string]: unknown;
}

interface AdminFallbackRow extends SongRow {
  is_admin_fallback?: boolean;
}

export interface CurrentTrackResponse {
  id: string;
  title: string;
  artist_name: string;
  audio_url: string;
  artwork_url?: string | null;
  duration_seconds?: number | null;
  is_playing: boolean;
  started_at: string;
  server_time: string;
  time_remaining_ms: number;
  position_seconds: number;
  credits_deducted?: number;
  is_fallback?: boolean;
  is_admin_fallback?: boolean;
  [key: string]: unknown;
}
// Buffer time before song ends to allow for network latency (2 seconds)
const SONG_END_BUFFER_MS = 2000;

/**
 * Radio service implementing:
 * - Pre-charge model: Credits deducted BEFORE playing via atomic RPC
 * - Soft-weighted random: Near-random with slight bias for credits + anti-repetition
 * - Fallback playlist: Opt-in songs and admin curated when no credited songs
 */
@Injectable()
export class RadioService {
  private readonly logger = new Logger(RadioService.name);

  /**
   * Calculate credits required for a song's full play.
   * Formula: ceil(duration_seconds / 5) = 1 credit per 5 seconds
   */
  private calculateCreditsRequired(durationSeconds: number): number {
    return Math.ceil(durationSeconds / 5);
  }

  /**
   * Get or create a queue state record in the database.
   * This ensures we have persistent state across server restarts.
   */
  private async getQueueState() {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('rotation_queue')
      .select('*')
      .eq('position', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return existing;
  }

  /**
   * Update the current playing song in the database.
   */
  private async setCurrentSong(songId: string, priorityScore: number = 0) {
    const supabase = getSupabaseClient();

    await supabase.from('rotation_queue').delete().eq('position', 0);

    await supabase.from('rotation_queue').insert({
      song_id: songId,
      priority_score: priorityScore,
      position: 0,
      played_at: new Date().toISOString(),
    });
  }

  /**
   * Get the current track with timing information for client synchronization.
   */
  async getCurrentTrack(): Promise<CurrentTrackResponse | null> {
    const supabase = getSupabaseClient();
    const now = Date.now();

    const queueState = (await this.getQueueState()) as QueueStateRow | null;

    if (!queueState || !queueState.song_id) {
      return null;
    }

    const { data: songData } = await supabase
      .from('songs')
      .select('*')
      .eq('id', queueState.song_id)
      .single();

    const song = songData as SongRow | null;
    if (!song) {
      return null;
    }

    const startedAt = new Date(queueState.played_at).getTime();
    const durationMs =
      (song.duration_seconds ?? DEFAULT_DURATION_SECONDS) * 1000;
    const endTime = startedAt + durationMs;
    const timeRemainingMs = Math.max(0, endTime - now);

    return {
      ...song,
      is_playing: timeRemainingMs > 0,
      started_at: queueState.played_at,
      server_time: new Date(now).toISOString(),
      time_remaining_ms: timeRemainingMs,
      position_seconds: Math.floor((now - startedAt) / 1000),
    } as CurrentTrackResponse;
  }

  /**
   * Soft-weighted random selection.
   * Close to pure random with minor nudges:
   * - +0.1 weight for above-average credits (reward investment)
   * - +0.1 weight for not played in last hour (anti-repetition)
   * - Max weight 1.2 (no song >20% more likely than another)
   */
  private selectWeightedRandom(
    songs: SongRow[],
    currentSongId?: string,
  ): SongRow | null {
    if (!songs || songs.length === 0) return null;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const avgCredits =
      songs.reduce((sum, s) => sum + (s.credits_remaining ?? 0), 0) /
      songs.length;

    const weightedSongs = songs.map((song) => {
      let weight = 1.0; // Base weight

      // +0.1 for above-average credits
      if ((song.credits_remaining ?? 0) > avgCredits) weight += 0.1;

      // +0.1 for not played recently
      if (!song.last_played_at || new Date(song.last_played_at) < oneHourAgo)
        weight += 0.1;

      // Exclude current song to avoid immediate repeat
      if (song.id === currentSongId) weight = 0;

      return { song, weight };
    });

    const totalWeight = weightedSongs.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight === 0) return songs[0] ?? null;

    let random = Math.random() * totalWeight;
    for (const { song, weight } of weightedSongs) {
      random -= weight;
      if (random <= 0) return song;
    }

    return songs[0] ?? null;
  }

  /**
   * Get credited song using soft-weighted random selection.
   * Only returns songs with enough credits for their full play duration.
   */
  private async getCreditedSong(
    currentSongId?: string,
  ): Promise<SongRow | null> {
    const supabase = getSupabaseClient();

    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    const songs = (songsData ?? []) as SongRow[];
    if (songs.length === 0) return null;

    // Filter to songs with ENOUGH credits for full play
    const eligibleSongs = songs.filter((song) => {
      const creditsRequired = this.calculateCreditsRequired(
        song.duration_seconds ?? DEFAULT_DURATION_SECONDS,
      );
      return (song.credits_remaining ?? 0) >= creditsRequired;
    });

    if (eligibleSongs.length === 0) return null;

    return this.selectWeightedRandom(eligibleSongs, currentSongId);
  }

  /**
   * Get opt-in song from artists who enabled free play.
   */
  private async getOptInSong(currentSongId?: string): Promise<SongRow | null> {
    const supabase = getSupabaseClient();

    const { data: songsData } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .eq('opt_in_free_play', true)
      .order('last_played_at', { ascending: true, nullsFirst: true })
      .limit(10);

    const songs = (songsData ?? []) as SongRow[];
    if (songs.length === 0) return null;

    // Filter out current song
    const eligible = songs.filter((s) => s.id !== currentSongId);
    if (eligible.length === 0) return songs[0] ?? null;

    // Random from oldest-played
    return eligible[Math.floor(Math.random() * eligible.length)] ?? null;
  }

  /**
   * Get admin-curated fallback song.
   */
  private async getAdminFallbackSong(): Promise<AdminFallbackRow | null> {
    const supabase = getSupabaseClient();

    const { data: songsData } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .eq('is_active', true)
      .order('play_count', { ascending: true })
      .limit(10);

    const songs = (songsData ?? []) as AdminFallbackRow[];
    if (songs.length === 0) return null;

    // Random from least-played
    const song = songs[Math.floor(Math.random() * songs.length)];
    return song ? { ...song, is_admin_fallback: true } : null;
  }

  /**
   * Get the next track for the global radio stream.
   * Implements pre-charge model with fallback cascade.
   */
  async getNextTrack(): Promise<CurrentTrackResponse | null> {
    const supabase = getSupabaseClient();
    const now = Date.now();

    const currentState = (await this.getQueueState()) as QueueStateRow | null;

    // Check if song currently playing
    if (currentState?.song_id && currentState?.played_at) {
      const { data: currentSongData } = await supabase
        .from('songs')
        .select('*')
        .eq('id', currentState.song_id)
        .single();

      const currentSong = currentSongData as SongRow | null;
      if (currentSong) {
        const startedAt = new Date(currentState.played_at).getTime();
        const durationMs =
          (currentSong.duration_seconds ?? DEFAULT_DURATION_SECONDS) * 1000;
        const endTime = startedAt + durationMs;
        const timeRemainingMs = endTime - now;

        if (timeRemainingMs > SONG_END_BUFFER_MS) {
          return {
            ...currentSong,
            is_playing: true,
            started_at: currentState.played_at,
            server_time: new Date(now).toISOString(),
            time_remaining_ms: timeRemainingMs,
            position_seconds: Math.floor((now - startedAt) / 1000),
          } as CurrentTrackResponse;
        }
      }
    }

    const currentSongId = currentState?.song_id;

    // 1. Try credited songs (pre-charge model)
    const creditedSong = await this.getCreditedSong(currentSongId);
    if (creditedSong) {
      const result = await this.playCreditedSong(creditedSong);
      if (result) return result;
    }

    // 2. Fall back to opt-in songs (free play)
    const optInSong = await this.getOptInSong(currentSongId);
    if (optInSong) {
      this.logger.log(`Playing opt-in fallback: ${optInSong.title}`);
      return await this.playFallbackSong(optInSong);
    }

    // 3. Fall back to admin curated playlist
    const fallbackSong = await this.getAdminFallbackSong();
    if (fallbackSong) {
      this.logger.log(`Playing admin fallback: ${fallbackSong.title}`);
      return await this.playAdminFallbackSong(fallbackSong);
    }

    this.logger.warn('No songs available for playback');
    return null;
  }

  /**
   * Play a credited song using pre-charge model (atomic RPC).
   */
  private async playCreditedSong(
    song: SongRow,
  ): Promise<CurrentTrackResponse | null> {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const creditsToDeduct = this.calculateCreditsRequired(
      song.duration_seconds ?? DEFAULT_DURATION_SECONDS,
    );

    // Atomic deduction via RPC (pre-charge)
    const { data, error } = await supabase.rpc('deduct_play_credits', {
      p_song_id: song.id,
      p_credits_required: creditsToDeduct,
    });

    const rpcData = data as { success?: boolean; error?: string } | null;
    if (error || !rpcData?.success) {
      this.logger.warn(
        `Failed to deduct credits for ${song.id}: ${error?.message ?? rpcData?.error}`,
      );
      return null;
    }

    await this.setCurrentSong(song.id, 0);

    // Log play
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    const durationMs =
      (song.duration_seconds ?? DEFAULT_DURATION_SECONDS) * 1000;

    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      credits_deducted: creditsToDeduct,
    } as CurrentTrackResponse;
  }

  /**
   * Play a fallback song (opt-in from artist, no credits deducted).
   */
  private async playFallbackSong(song: SongRow): Promise<CurrentTrackResponse> {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();

    await this.setCurrentSong(song.id, 0);

    // Update play count and last_played_at (no credit deduction)
    await supabase
      .from('songs')
      .update({
        play_count: (song.play_count ?? 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    const durationMs =
      (song.duration_seconds ?? DEFAULT_DURATION_SECONDS) * 1000;

    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_fallback: true,
    } as CurrentTrackResponse;
  }

  /**
   * Play an admin-curated fallback song.
   */
  private async playAdminFallbackSong(
    song: AdminFallbackRow,
  ): Promise<CurrentTrackResponse> {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();

    // Note: admin_fallback_songs use their own ID, not songs table
    await supabase.from('rotation_queue').delete().eq('position', 0);

    // We can't reference admin_fallback_songs.id in rotation_queue.song_id (FK constraint)
    // So we just clear state and track separately

    await supabase
      .from('admin_fallback_songs')
      .update({
        play_count: (song.play_count ?? 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    const durationMs =
      (song.duration_seconds ?? DEFAULT_DURATION_SECONDS) * 1000;

    return {
      id: song.id,
      title: song.title,
      artist_name: song.artist_name,
      audio_url: song.audio_url,
      artwork_url: song.artwork_url,
      duration_seconds: song.duration_seconds,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_fallback: true,
      is_admin_fallback: true,
    } as CurrentTrackResponse;
  }

  async reportPlay(songId: string, skipped: boolean = false) {
    const supabase = getSupabaseClient();

    await supabase.from('plays').insert({
      song_id: songId,
      skipped,
      played_at: new Date().toISOString(),
    });

    if (skipped) {
      const { data: songData } = await supabase
        .from('songs')
        .select('skip_count')
        .eq('id', songId)
        .single();

      const song = songData as { skip_count?: number } | null;
      if (song) {
        await supabase
          .from('songs')
          .update({ skip_count: (song.skip_count ?? 0) + 1 })
          .eq('id', songId);
      }
    }
  }

  /**
   * Get upcoming songs in the queue (for preview/admin purposes).
   */
  async getUpcomingQueue(limit: number = 10): Promise<Partial<SongRow>[]> {
    const supabase = getSupabaseClient();

    const currentState = (await this.getQueueState()) as QueueStateRow | null;
    const currentSongId = currentState?.song_id;

    // Get credited songs
    const { data: creditedSongsData } = await supabase
      .from('songs')
      .select(
        'id, title, artist_name, artwork_url, credits_remaining, play_count, like_count, duration_seconds',
      )
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    type QueuePreviewRow = Pick<
      SongRow,
      | 'id'
      | 'title'
      | 'artist_name'
      | 'artwork_url'
      | 'credits_remaining'
      | 'play_count'
      | 'like_count'
      | 'duration_seconds'
    >;
    const creditedSongs = (creditedSongsData ?? []) as QueuePreviewRow[];

    // Filter eligible songs
    const eligible = creditedSongs.filter((song) => {
      const creditsRequired = this.calculateCreditsRequired(
        song.duration_seconds ?? DEFAULT_DURATION_SECONDS,
      );
      return (
        (song.credits_remaining ?? 0) >= creditsRequired &&
        song.id !== currentSongId
      );
    });

    // Sort by credits (higher first for preview)
    eligible.sort(
      (a, b) => (b.credits_remaining ?? 0) - (a.credits_remaining ?? 0),
    );

    return eligible.slice(0, limit);
  }

  /**
   * Clear the current queue state (useful for admin operations).
   */
  async clearQueueState() {
    const supabase = getSupabaseClient();

    await supabase.from('rotation_queue').delete().eq('position', 0);

    return { cleared: true };
  }
}
