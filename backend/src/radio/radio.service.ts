import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { EmojiService } from '../chat/emoji.service';
import { RadioStateService, RadioState, PlayDecision } from './radio-state.service';

// Default song duration if not specified (3 minutes in seconds)
const DEFAULT_DURATION_SECONDS = 180;
// Buffer time before song ends to allow for network latency (2 seconds)
const SONG_END_BUFFER_MS = 2000;

/**
 * Radio service implementing:
 * - Pre-charge model: Credits deducted BEFORE playing via atomic RPC
 * - Soft-weighted random: Near-random with slight bias for credits + anti-repetition
 * - Fallback playlist: Opt-in songs and admin curated when no credited songs
 * - Two-stage artist notifications: "Up Next" (T-60s) and "Live Now"
 * - Redis-backed state management for scalability
 */
@Injectable()
export class RadioService {
  private readonly logger = new Logger(RadioService.name);

  constructor(
    @Inject(forwardRef(() => PushNotificationService))
    private readonly pushNotificationService: PushNotificationService,
    @Inject(forwardRef(() => EmojiService))
    private readonly emojiService: EmojiService,
    private readonly radioStateService: RadioStateService,
  ) {}

  /**
   * Calculate credits required for a song's full play.
   * Formula: ceil(duration_seconds / 5) = 1 credit per 5 seconds
   */
  private calculateCreditsRequired(durationSeconds: number): number {
    return Math.ceil(durationSeconds / 5);
  }

  /**
   * Get queue state from Redis (with DB fallback).
   */
  private async getQueueState(): Promise<RadioState | null> {
    return this.radioStateService.getCurrentState();
  }

  /**
   * Update the current playing song in Redis + DB.
   */
  private async setCurrentSong(
    songId: string, 
    durationSeconds: number,
    priorityScore: number = 0, 
    isFallback: boolean = false,
    isAdminFallback: boolean = false,
  ): Promise<void> {
    const now = Date.now();
    const playedAt = new Date(now).toISOString();
    
    const state: RadioState = {
      songId,
      startedAt: now,
      durationMs: durationSeconds * 1000,
      priorityScore,
      isFallback,
      isAdminFallback,
      playedAt,
    };
    
    await this.radioStateService.setCurrentState(state);
  }

  /**
   * Get the current track with timing information for client synchronization.
   * If nothing is playing, automatically starts the next track.
   */
  async getCurrentTrack() {
    const supabase = getSupabaseClient();
    const now = Date.now();
    
    const queueState = await this.getQueueState();
    
    // If nothing is playing, start the next track
    if (!queueState || !queueState.songId) {
      this.logger.log('No current track, auto-starting next track');
      return this.getNextTrack();
    }

    const { data: song } = await supabase
      .from('songs')
      .select('*')
      .eq('id', queueState.songId)
      .single();

    if (!song) {
      // Song was deleted, get next track
      this.logger.log('Current song not found, auto-starting next track');
      return this.getNextTrack();
    }

    const startedAt = queueState.startedAt;
    const durationMs = queueState.durationMs || (song.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
    const endTime = startedAt + durationMs;
    const timeRemainingMs = Math.max(0, endTime - now);

    // If song has ended, get next track
    if (timeRemainingMs <= 0) {
      this.logger.log('Current song ended, auto-starting next track');
      return this.getNextTrack();
    }

    return {
      ...song,
      is_playing: true,
      started_at: queueState.playedAt,
      server_time: new Date(now).toISOString(),
      time_remaining_ms: timeRemainingMs,
      position_seconds: Math.floor((now - startedAt) / 1000),
    };
  }

  /**
   * Soft-weighted random selection.
   * Close to pure random with minor nudges:
   * - +0.1 weight for above-average credits (reward investment)
   * - +0.1 weight for not played in last hour (anti-repetition)
   * - Max weight 1.2 (no song >20% more likely than another)
   */
  private selectWeightedRandom(songs: any[], currentSongId?: string): any | null {
    if (!songs || songs.length === 0) return null;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const avgCredits = songs.reduce((sum, s) => sum + (s.credits_remaining || 0), 0) / songs.length;

    const weightedSongs = songs.map(song => {
      let weight = 1.0; // Base weight

      // +0.1 for above-average credits
      if ((song.credits_remaining || 0) > avgCredits) weight += 0.1;

      // +0.1 for not played recently
      if (!song.last_played_at || new Date(song.last_played_at) < oneHourAgo) weight += 0.1;

      // Exclude current song to avoid immediate repeat
      if (song.id === currentSongId) weight = 0;

      return { song, weight };
    });

    const totalWeight = weightedSongs.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight === 0) return songs[0];

    let random = Math.random() * totalWeight;
    for (const { song, weight } of weightedSongs) {
      random -= weight;
      if (random <= 0) return song;
    }

    return songs[0];
  }

  /**
   * Get credited song using soft-weighted random selection.
   * Only returns songs with enough credits for their full play duration.
   * Returns both the song and metadata for logging.
   */
  private async getCreditedSong(currentSongId?: string): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;

    // Filter to songs with ENOUGH credits for full play
    const eligibleSongs = songs.filter(song => {
      const creditsRequired = this.calculateCreditsRequired(song.duration_seconds || DEFAULT_DURATION_SECONDS);
      return (song.credits_remaining || 0) >= creditsRequired;
    });

    if (eligibleSongs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(eligibleSongs, currentSongId);
    return { song: selectedSong, competingSongs: eligibleSongs.length };
  }

  /**
   * Get trial song - newly approved songs with remaining trial plays.
   * Trial plays give new artists exposure before requiring credits.
   */
  private async getTrialSong(currentSongId?: string): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('trial_plays_remaining', 0)
      .order('created_at', { ascending: true }) // Oldest first (FIFO fairness)
      .limit(20);

    if (!songs || songs.length === 0) return null;

    // Filter out current song
    const eligible = songs.filter(s => s.id !== currentSongId);
    if (eligible.length === 0) return null;

    // Weighted random favoring newest uploads slightly
    const selectedSong = this.selectWeightedRandom(eligible, currentSongId);
    return { song: selectedSong, competingSongs: eligible.length };
  }

  /**
   * Get opt-in song from artists who enabled free play.
   */
  private async getOptInSong(currentSongId?: string): Promise<any | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .eq('opt_in_free_play', true)
      .order('last_played_at', { ascending: true, nullsFirst: true })
      .limit(10);

    if (!songs || songs.length === 0) return null;

    // Filter out current song
    const eligible = songs.filter(s => s.id !== currentSongId);
    if (eligible.length === 0) return songs[0];

    // Random from oldest-played
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  /**
   * Get admin-curated fallback song.
   */
  private async getAdminFallbackSong(): Promise<any | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .eq('is_active', true)
      .order('play_count', { ascending: true })
      .limit(10);

    if (!songs || songs.length === 0) return null;

    // Random from least-played
    const song = songs[Math.floor(Math.random() * songs.length)];
    return { ...song, is_admin_fallback: true };
  }

  /**
   * Get the next track for the global radio stream.
   * Implements pre-charge model with fallback cascade.
   */
  async getNextTrack(): Promise<any> {
    const supabase = getSupabaseClient();
    const now = Date.now();

    const currentState = await this.getQueueState();
    
    // Check if song currently playing
    if (currentState?.songId && currentState?.startedAt) {
      const { data: currentSong } = await supabase
        .from('songs')
        .select('*')
        .eq('id', currentState.songId)
        .single();

      if (currentSong) {
        const startedAt = currentState.startedAt;
        const durationMs = currentState.durationMs || (currentSong.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
        const endTime = startedAt + durationMs;
        const timeRemainingMs = endTime - now;

        if (timeRemainingMs > SONG_END_BUFFER_MS) {
          return {
            ...currentSong,
            is_playing: true,
            started_at: currentState.playedAt,
            server_time: new Date(now).toISOString(),
            time_remaining_ms: timeRemainingMs,
            position_seconds: Math.floor((now - startedAt) / 1000),
          };
        }
      }
    }

    const currentSongId = currentState?.songId;

    // 1. Try credited songs (pre-charge model)
    const creditedResult = await this.getCreditedSong(currentSongId);
    if (creditedResult) {
      const result = await this.playCreditedSong(creditedResult.song, creditedResult.competingSongs);
      if (result) return result;
    }

    // 2. Try trial songs (new artists get free exposure)
    const trialResult = await this.getTrialSong(currentSongId);
    if (trialResult) {
      this.logger.log(`Playing trial song: ${trialResult.song.title}`);
      const result = await this.playTrialSong(trialResult.song, trialResult.competingSongs);
      if (result) return result;
    }

    // 3. Fall back to opt-in songs (free play)
    const optInSong = await this.getOptInSong(currentSongId);
    if (optInSong) {
      this.logger.log(`Playing opt-in fallback: ${optInSong.title}`);
      return await this.playFallbackSong(optInSong);
    }

    // 4. Fall back to admin curated playlist
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
   * Also sends "Live Now" notification to the artist and logs the decision.
   */
  private async playCreditedSong(song: any, competingSongs: number = 0) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;
    const creditsToDeduct = this.calculateCreditsRequired(durationSeconds);

    // Atomic deduction via RPC (pre-charge)
    const { data, error } = await supabase.rpc('deduct_play_credits', {
      p_song_id: song.id,
      p_credits_required: creditsToDeduct,
    });

    if (error || !data?.success) {
      this.logger.warn(`Failed to deduct credits for ${song.id}: ${error?.message || data?.error}`);
      return null;
    }

    await this.setCurrentSong(song.id, durationSeconds, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Log play decision for transparency
    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'credits',
      listenerCount,
      competingSongs,
    });

    // Log play
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    // Send "Live Now" notification to artist (Stage 2)
    try {
      await this.pushNotificationService.sendLiveNowNotification({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
      });
    } catch (e) {
      this.logger.warn(`Failed to send Live Now notification: ${e.message}`);
    }

    const durationMs = durationSeconds * 1000;

    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      credits_deducted: creditsToDeduct,
    };
  }

  /**
   * Play a trial song - new artist gets free exposure.
   * Decrements trial_plays_remaining, no credits deducted.
   */
  private async playTrialSong(song: any, competingSongs: number = 0) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    // Check and decrement trial plays atomically
    const { data: updated, error } = await supabase
      .from('songs')
      .update({
        trial_plays_remaining: Math.max(0, (song.trial_plays_remaining || 0) - 1),
        trial_plays_used: (song.trial_plays_used || 0) + 1,
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id)
      .gt('trial_plays_remaining', 0) // Only update if still has trials
      .select()
      .single();

    if (error || !updated) {
      this.logger.warn(`Failed to decrement trial plays for ${song.id}: ${error?.message || 'No trial plays remaining'}`);
      return null;
    }

    await this.setCurrentSong(song.id, durationSeconds, 0, true, false);

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'trial',
      listenerCount,
      competingSongs,
    });

    // Log play
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    // Notify artist of trial play
    try {
      await this.pushNotificationService.sendLiveNowNotification({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
      });
    } catch (e) {
      this.logger.warn(`Failed to send trial play notification: ${e.message}`);
    }

    const durationMs = durationSeconds * 1000;

    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_trial_play: true,
      trial_plays_remaining: updated.trial_plays_remaining,
    };
  }

  /**
   * Play a fallback song (opt-in from artist, no credits deducted).
   */
  private async playFallbackSong(song: any) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    await this.setCurrentSong(song.id, durationSeconds, 0, true, false);

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'opt_in',
      listenerCount,
    });

    // Update play count and last_played_at (no credit deduction)
    await supabase
      .from('songs')
      .update({ 
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    const durationMs = durationSeconds * 1000;

    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_fallback: true,
    };
  }

  /**
   * Play an admin-curated fallback song.
   */
  private async playAdminFallbackSong(song: any) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    // Set state in Redis (admin fallback songs have different IDs)
    // We use a special marker for admin fallback
    await this.radioStateService.setCurrentState({
      songId: `admin:${song.id}`,
      startedAt: now,
      durationMs: durationSeconds * 1000,
      priorityScore: 0,
      isFallback: true,
      isAdminFallback: true,
      playedAt: startedAt,
    });

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'admin_fallback',
      listenerCount,
    });
    
    await supabase
      .from('admin_fallback_songs')
      .update({ 
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    const durationMs = durationSeconds * 1000;

    return {
      id: song.id,
      title: song.title,
      artist_name: song.artist_name,
      audio_url: song.audio_url,
      artwork_url: song.artwork_url,
      duration_seconds: durationSeconds,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_fallback: true,
      is_admin_fallback: true,
    };
  }

  async reportPlay(songId: string, skipped: boolean = false) {
    const supabase = getSupabaseClient();

    await supabase.from('plays').insert({
      song_id: songId,
      skipped,
      played_at: new Date().toISOString(),
    });

    if (skipped) {
      const { data: song } = await supabase
        .from('songs')
        .select('skip_count')
        .eq('id', songId)
        .single();

      if (song) {
        await supabase
          .from('songs')
          .update({ skip_count: (song.skip_count || 0) + 1 })
          .eq('id', songId);
      }
    }
  }

  /**
   * Get upcoming songs in the queue (for preview/admin purposes).
   */
  async getUpcomingQueue(limit: number = 10) {
    const supabase = getSupabaseClient();

    const currentState = await this.getQueueState();
    const currentSongId = currentState?.songId;

    // Get credited songs
    const { data: creditedSongs } = await supabase
      .from('songs')
      .select('id, title, artist_name, artwork_url, credits_remaining, play_count, like_count, duration_seconds')
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    // Filter eligible songs
    const eligible = (creditedSongs || []).filter(song => {
      const creditsRequired = this.calculateCreditsRequired(song.duration_seconds || DEFAULT_DURATION_SECONDS);
      return song.credits_remaining >= creditsRequired && song.id !== currentSongId;
    });

    // Sort by credits (higher first for preview)
    eligible.sort((a, b) => (b.credits_remaining || 0) - (a.credits_remaining || 0));

    return eligible.slice(0, limit);
  }

  /**
   * Clear the current queue state (useful for admin operations).
   */
  async clearQueueState() {
    await this.radioStateService.clearState();
    return { cleared: true };
  }
}
