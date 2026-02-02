import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { EmojiService } from '../chat/emoji.service';
import { RadioStateService, RadioState, PlayDecision, PlaylistState } from './radio-state.service';

// Default song duration if not specified (3 minutes in seconds)
const DEFAULT_DURATION_SECONDS = 180;
// Buffer time before song ends to allow for network latency (2 seconds)
const SONG_END_BUFFER_MS = 2000;

// === Hysteresis Thresholds ===
// Uses different thresholds for entering vs exiting paid mode to prevent rapid oscillation
// when listener count hovers at the boundary (e.g., 4-5-4-5)
const THRESHOLD_ENTER_PAID = parseInt(process.env.THRESHOLD_ENTER_PAID || '5', 10);
const THRESHOLD_EXIT_PAID = parseInt(process.env.THRESHOLD_EXIT_PAID || '3', 10);

// Checkpoint frequency: save position to database every N songs during free rotation
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL || '5', 10);

/**
 * Simple seeded random number generator (Mulberry32).
 * Produces deterministic sequence for reproducible shuffles.
 */
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Convert string seed to numeric seed.
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministic shuffle using Fisher-Yates with seeded random.
 * Same seed always produces same shuffle order (for debugging/audit).
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const numericSeed = stringToSeed(seed);
  const rng = seededRandom(numericSeed);
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

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
  private nextSongNotifiedFor: string | null = null;

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

    if (!queueState.isAdminFallback && timeRemainingMs <= 60000 && timeRemainingMs > SONG_END_BUFFER_MS) {
      this.checkAndScheduleUpNext(timeRemainingMs, song.id).catch((e) =>
        this.logger.warn(`Failed to schedule Up Next: ${e.message}`),
      );
    }

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
   * Get trial song for artists with free trial plays remaining.
   * Only returns songs with trial plays available and no credits.
   */
  private async getTrialSong(currentSongId?: string): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('trial_plays_remaining', 0)
      .lte('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(songs, currentSongId);
    return { song: selectedSong, competingSongs: songs.length };
  }

  /**
   * Get opt-in song for free rotation after trial plays are exhausted.
   */
  private async getOptInSong(currentSongId?: string): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .eq('opt_in_free_play', true)
      .lte('trial_plays_remaining', 0)
      .lte('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(songs, currentSongId);
    return { song: selectedSong, competingSongs: songs.length };
  }

  // === Free Rotation Stack Methods ===

  /**
   * Get all active songs from free rotation: admin_fallback_songs + songs table (admin_free_rotation).
   */
  private async getAllFreeRotationSongs(): Promise<{ id: string; _stackId: string }[]> {
    const supabase = getSupabaseClient();
    const result: { id: string; _stackId: string }[] = [];

    const { data: adminSongs, error: adminError } = await supabase
      .from('admin_fallback_songs')
      .select('id')
      .eq('is_active', true);

    if (adminError) {
      this.logger.error(`Failed to fetch admin fallback songs: ${adminError.message}`);
    } else if (adminSongs?.length) {
      for (const s of adminSongs) {
        result.push({ id: s.id, _stackId: `admin:${s.id}` });
      }
    }

    const { data: songsData, error: songsError } = await supabase
      .from('songs')
      .select('id')
      .eq('status', 'approved')
      .eq('admin_free_rotation', true)
      .eq('opt_in_free_play', true);

    if (songsError) {
      this.logger.error(`Failed to fetch admin-free-rotation songs: ${songsError.message}`);
    } else if (songsData?.length) {
      for (const s of songsData) {
        result.push({ id: s.id, _stackId: `song:${s.id}` });
      }
    }

    return result;
  }

  /**
   * Get a specific free rotation song by stack ID (admin:uuid, song:uuid, or legacy plain uuid).
   */
  private async getFreeRotationSongById(stackId: string): Promise<any | null> {
    const supabase = getSupabaseClient();
    const isAdmin = stackId.startsWith('admin:');
    const isSong = stackId.startsWith('song:');
    const actualId = stackId.replace(/^admin:|^song:/, '');

    if (isAdmin) {
      const { data, error } = await supabase
        .from('admin_fallback_songs')
        .select('*')
        .eq('id', actualId)
        .single();
      if (error || !data) {
        this.logger.warn(`Admin fallback song ${actualId} not found`);
        return null;
      }
      return { ...data, _source: 'admin_fallback' as const };
    }

    if (isSong) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', actualId)
        .single();
      if (error || !data) {
        this.logger.warn(`Free rotation song ${actualId} not found`);
        return null;
      }
      return { ...data, _source: 'songs' as const };
    }

    // Legacy: plain uuid (try admin_fallback first, then songs)
    const { data: adminData } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .eq('id', stackId)
      .single();
    if (adminData) return { ...adminData, _source: 'admin_fallback' as const };

    const { data: songData } = await supabase
      .from('songs')
      .select('*')
      .eq('id', stackId)
      .eq('status', 'approved')
      .eq('admin_free_rotation', true)
      .eq('opt_in_free_play', true)
      .single();
    if (songData) return { ...songData, _source: 'songs' as const };

    return null;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm.
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get the next song from the free rotation stack.
   * If the stack is empty, fetches all songs from admin_fallback_songs,
   * shuffles them, and stores in the stack.
   * Uses stack_version_hash to only write full stack when content changes.
   * Returns null if no free rotation songs are available.
   */
  private async getNextFreeRotationSong(): Promise<any | null> {
    // Try to pop from the existing stack (Redis)
    let songId = await this.radioStateService.popFreeRotationSong();
    
    if (!songId) {
      // Stack is empty - refill from admin_fallback_songs + songs (admin_free_rotation)
      const allSongs = await this.getAllFreeRotationSongs();
      
      if (allSongs.length === 0) {
        this.logger.warn('No free rotation songs available (admin_fallback_songs or songs with admin_free_rotation)');
        return null;
      }
      
      // Shuffle stack IDs (admin:uuid or song:uuid)
      const shuffledIds = this.shuffleArray(allSongs.map(s => s._stackId));
      
      // Set in Redis for fast access
      await this.radioStateService.setFreeRotationStack(shuffledIds);
      
      // Check if we need to save the full stack to Supabase
      // (Only if the content has changed - compare hashes)
      await this.saveStackIfChanged(shuffledIds);
      
      // Reset position to 0 since we're starting fresh
      await this.radioStateService.setFallbackPosition(0);
      
      this.logger.log(`Refilled free rotation stack with ${shuffledIds.length} shuffled songs`);
      
      // Pop the first one (returns null when Redis is unavailable)
      songId = await this.radioStateService.popFreeRotationSong();
      
      // Fallback when Redis is unavailable: pick random song directly from shuffled list
      if (!songId && shuffledIds.length > 0) {
        songId = shuffledIds[Math.floor(Math.random() * shuffledIds.length)];
        this.logger.log('Redis unavailable - picked random song directly from pool');
      }
    }
    
    if (!songId) {
      return null;
    }
    
    // Fetch the full song data
    return await this.getFreeRotationSongById(songId);
  }

  /**
   * Save stack to Supabase only if the content has changed.
   * Uses stack_version_hash to detect changes.
   * This optimizes JSONB writes by avoiding unnecessary full-stack updates.
   */
  private async saveStackIfChanged(newStack: string[]): Promise<void> {
    const supabase = getSupabaseClient();
    const crypto = require('crypto');
    
    // Compute hash of new stack
    const newHash = crypto.createHash('md5').update(newStack.sort().join(',')).digest('hex');
    
    // Get current hash from database
    const { data } = await supabase
      .from('radio_playlist_state')
      .select('stack_version_hash')
      .eq('id', 'global')
      .single();
    
    const currentHash = data?.stack_version_hash;
    
    // Only write full stack if hash changed (content changed)
    if (currentHash !== newHash) {
      await this.radioStateService.saveFullPlaylistState(newStack, 0);
      this.logger.log(`Stack content changed - saved full stack to Supabase (${newStack.length} songs)`);
    } else {
      this.logger.log('Stack content unchanged - skipping full stack write');
    }
  }

  /**
   * Get the next track for the global radio stream.
   * Production-ready flow with hysteresis:
   * 1. Check if song currently playing - if so, return it
   * 2. Get listener count and current playlist type
   * 3. Apply hysteresis logic to determine target playlist type
   * 4. Handle playlist switch if needed (save/restore positions)
   * 5. Play from appropriate playlist with checkpointing
   */
  async getNextTrack(): Promise<any> {
    const supabase = getSupabaseClient();
    const now = Date.now();

    const currentState = await this.getQueueState();
    
    // Check if song currently playing
    if (currentState?.songId && currentState?.startedAt) {
      const isAdminSong = currentState.songId.startsWith('admin:');
      const actualSongId = currentState.songId.replace(/^admin:|^song:/, '');

      let currentSong;
      if (isAdminSong) {
        const { data } = await supabase
          .from('admin_fallback_songs')
          .select('*')
          .eq('id', actualSongId)
          .single();
        currentSong = data;
      } else {
        const { data } = await supabase
          .from('songs')
          .select('*')
          .eq('id', actualSongId)
          .single();
        currentSong = data;
      }

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
            is_fallback: currentState.isFallback,
            is_admin_fallback: currentState.isAdminFallback,
          };
        }
      }
    }

    const currentSongId = currentState?.songId;
    this.nextSongNotifiedFor = null;

    // Get listener count and current playlist type
    const listenerCount = await this.radioStateService.getListenerCount();
    const currentType = await this.radioStateService.getCurrentPlaylistType();
    
    // Apply hysteresis logic to determine target playlist type
    let targetType = currentType;
    
    if (currentType === 'free_rotation' && listenerCount >= THRESHOLD_ENTER_PAID) {
      targetType = 'paid';
      this.logger.log(`Switching to PAID playlist (listeners: ${listenerCount} >= ${THRESHOLD_ENTER_PAID})`);
    } else if (currentType === 'paid' && listenerCount <= THRESHOLD_EXIT_PAID) {
      targetType = 'free_rotation';
      this.logger.log(`Switching to FREE playlist (listeners: ${listenerCount} <= ${THRESHOLD_EXIT_PAID})`);
    }

    // Handle playlist switch if type changed
    if (currentType !== targetType) {
      await this.handlePlaylistSwitch(currentType, targetType);
    }

    this.logger.log(`Current listener count: ${listenerCount}, playlist type: ${targetType}`);

    // Play from appropriate playlist
    if (targetType === 'paid') {
      // Try credited songs (pre-charge model)
      const creditedResult = await this.getCreditedSong(currentSongId);
      if (creditedResult) {
        const result = await this.playCreditedSong(creditedResult.song, creditedResult.competingSongs);
        if (result) return result;
      }

      // Try trial songs (3 free plays)
      const trialResult = await this.getTrialSong(currentSongId);
      if (trialResult) {
        const result = await this.playTrialSong(trialResult.song, trialResult.competingSongs);
        if (result) return result;
      }

      // Try opt-in songs (free rotation opt-in)
      const optInResult = await this.getOptInSong(currentSongId);
      if (optInResult) {
        const result = await this.playOptInSong(optInResult.song, optInResult.competingSongs);
        if (result) return result;
      }

      // No credited, trial, or opt-in songs available - fall back to free rotation
      this.logger.log('No credited, trial, or opt-in songs available in paid mode, falling back to free rotation');
    }

    // Free rotation mode (or fallback from paid mode)
    const freeRotationSong = await this.getNextFreeRotationSong();
    if (freeRotationSong) {
      this.logger.log(`Playing free rotation song: ${freeRotationSong.title}`);
      const result = await this.playFreeRotationSong(freeRotationSong);
      
      // Checkpoint position after playing free rotation song
      const position = await this.radioStateService.getFallbackPosition();
      await this.radioStateService.checkpointPosition(position + 1);
      
      return result;
    }

    // No content available
    this.logger.warn('No songs available for playback - free rotation table is empty');
    return this.buildNoContentResponse();
  }

  /**
   * Handle playlist switch with state persistence.
   * Saves current position before switching, loads saved position when returning.
   */
  private async handlePlaylistSwitch(from: 'free_rotation' | 'paid', to: 'free_rotation' | 'paid'): Promise<void> {
    if (from === 'free_rotation' && to === 'paid') {
      // Switching TO paid: save current free rotation state immediately
      const position = await this.radioStateService.getFallbackPosition();
      await this.radioStateService.syncPositionToSupabase(position);
      this.logger.log(`Saved free rotation position before switching to paid: ${position}`);
    } 
    else if (from === 'paid' && to === 'free_rotation') {
      // Switching TO free: load saved state from Supabase
      const state = await this.radioStateService.loadPlaylistStateFromDb();
      if (state) {
        // Restore the stack and position to Redis
        if (state.fallbackStack.length > 0) {
          await this.radioStateService.setFreeRotationStack(state.fallbackStack);
        }
        await this.radioStateService.setFallbackPosition(state.fallbackPosition);
        this.logger.log(`Restored free rotation at position: ${state.fallbackPosition}`);
      }
    }
    
    // Update the playlist type
    await this.radioStateService.setCurrentPlaylistType(to);
    await this.radioStateService.resetCheckpointCounter();
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

    // Increment paid_play_count, play_count, last_played_at
    await supabase
      .from('songs')
      .update({
        paid_play_count: (song.paid_play_count || 0) + 1,
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

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
   * Play a trial song (free plays before credits are required).
   */
  private async playTrialSong(song: any, competingSongs: number = 0) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    await this.setCurrentSong(song.id, durationSeconds, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Decrement trial plays, increment used counter, update last_played_at and play_count
    const remaining = Math.max(0, (song.trial_plays_remaining || 0) - 1);
    const used = (song.trial_plays_used || 0) + 1;
    await supabase
      .from('songs')
      .update({
        trial_plays_remaining: remaining,
        trial_plays_used: used,
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

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

    // Send "Live Now" notification to artist
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
      trial_plays_remaining: remaining,
      trial_plays_used: used,
    };
  }

  /**
   * Play an opt-in song (free rotation opt-in).
   */
  private async playOptInSong(song: any, competingSongs: number = 0) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    await this.setCurrentSong(song.id, durationSeconds, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'opt_in',
      listenerCount,
      competingSongs,
    });

    // Log play
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    // Update play_count and last_played_at
    await supabase
      .from('songs')
      .update({
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    // Send "Live Now" notification to artist
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
    };
  }

  /**
   * Play a song from the free rotation (admin_fallback_songs or songs table).
   * Uses the shuffled stack pattern - songs are played in random order
   * and the stack is refilled when empty.
   */
  private async playFreeRotationSong(song: any) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;
    const isFromAdminTable = song._source === 'admin_fallback';
    const stateSongId = isFromAdminTable ? `admin:${song.id}` : song.id;

    await this.radioStateService.setCurrentState({
      songId: stateSongId,
      startedAt: now,
      durationMs: durationSeconds * 1000,
      priorityScore: 0,
      isFallback: true,
      isAdminFallback: true,
      playedAt: startedAt,
    });

    const listenerCount = await this.radioStateService.getListenerCount();
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'admin_fallback',
      listenerCount,
    });

    if (isFromAdminTable) {
      await supabase
        .from('admin_fallback_songs')
        .update({
          play_count: (song.play_count || 0) + 1,
          last_played_at: startedAt,
        })
        .eq('id', song.id);
    } else {
      await supabase.from('plays').insert({
        song_id: song.id,
        played_at: startedAt,
      });
      // Update songs table play_count and last_played_at
      await supabase
        .from('songs')
        .update({
          play_count: (song.play_count || 0) + 1,
          last_played_at: startedAt,
        })
        .eq('id', song.id);
    }

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

  /**
   * Build response when no content is available.
   * This happens when the free rotation table is empty.
   */
  private buildNoContentResponse(): any {
    const now = new Date().toISOString();
    
    return {
      id: null,
      title: 'No Content Available',
      artist_name: 'RadioApp',
      audio_url: null,
      artwork_url: null,
      duration_seconds: 0,
      is_playing: false,
      started_at: now,
      server_time: now,
      time_remaining_ms: 0,
      position_seconds: 0,
      is_fallback: true,
      is_admin_fallback: true,
      no_content: true,
      message: 'Sorry for the inconvenience. No songs are currently available.',
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

  /**
   * Preview the next song for Up Next notifications without changing state.
   */
  private async preSelectNextSong(currentSongId?: string): Promise<any | null> {
    const creditedResult = await this.getCreditedSong(currentSongId);
    if (creditedResult) return creditedResult.song;

    const trialResult = await this.getTrialSong(currentSongId);
    if (trialResult) return trialResult.song;

    const optInResult = await this.getOptInSong(currentSongId);
    if (optInResult) return optInResult.song;

    return null;
  }

  /**
   * Schedule Up Next notification around 60 seconds before the song ends.
   */
  private async checkAndScheduleUpNext(timeRemainingMs: number, currentSongId: string): Promise<void> {
    if (timeRemainingMs > 60000 || timeRemainingMs < 30000) return;
    if (this.nextSongNotifiedFor === currentSongId) return;

    const nextSong = await this.preSelectNextSong(currentSongId);
    if (nextSong) {
      await this.pushNotificationService.scheduleUpNextNotification(nextSong, 60);
      this.nextSongNotifiedFor = currentSongId;
    }
  }
}
