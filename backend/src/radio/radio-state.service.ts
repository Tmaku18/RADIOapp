import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';
import { getSupabaseClient } from '../config/supabase.config';
import * as crypto from 'crypto';
import { DEFAULT_STATION_ID } from './station.constants';

/** Default radio when none specified (unsigned home, marketing pages, legacy global). */
export const DEFAULT_RADIO_ID = DEFAULT_STATION_ID;

/**
 * Redis key structure per radio: radio:{radioId}:* so each radio has its own state.
 */
function redisKeys(radioId: string) {
  const prefix = `radio:${radioId}:`;
  return {
    CURRENT_STATE: prefix + 'current',
    LISTENER_COUNT: prefix + 'listeners',
    PRIME_TIME_ACTIVE: prefix + 'prime_time',
    PLAYLIST_STATE: prefix + 'playlist',
    FREE_ROTATION_STACK: prefix + 'free_rotation_stack',
    FREE_ROTATION_PLAYED: prefix + 'free_rotation_played',
    PLAYLIST_TYPE: prefix + 'playlist_type',
    FALLBACK_POSITION: prefix + 'fallback_position',
    SONGS_SINCE_CHECKPOINT: prefix + 'songs_since_checkpoint',
    CURRENT_PLAY_ID: prefix + 'current_play_id',
    CURRENT_PLAY_ARTIST_ID: prefix + 'current_play_artist_id',
    CURRENT_PLAY_STARTED_AT: prefix + 'current_play_started_at',
    TRANSPORT: prefix + 'transport',
    BOOTH: prefix + 'booth',
    HISTORY: prefix + 'history',
  };
}

export interface RadioTransportState {
  paused: boolean;
  pausedAt: number | null;
  positionSeconds: number;
}

export interface RadioBoothState {
  micActive: boolean;
  duckVolume: number;
  hlsUrl: string | null;
  sessionId: string | null;
}

export interface RadioHistoryEntry {
  songId: string;
  startedAt: number;
  durationMs: number;
  positionSeconds: number;
}

const HISTORY_MAX = 20;
const DEFAULT_DUCK_VOLUME = 0.25;

// Checkpoint frequency for saving to Supabase
const CHECKPOINT_INTERVAL = parseInt(
  process.env.CHECKPOINT_INTERVAL || '5',
  10,
);

export interface RadioState {
  songId: string;
  startedAt: number; // Unix timestamp ms
  durationMs: number;
  priorityScore: number;
  isFallback: boolean;
  isAdminFallback: boolean;
  playedAt: string; // ISO string for compatibility
}

export interface PlayDecision {
  songId: string;
  selectedAt: string;
  selectionReason:
    | 'credits'
    | 'trial'
    | 'opt_in'
    | 'fallback';
  tierAtSelection?: string;
  listenerCount?: number;
  weightScore?: number;
  competingSongs?: number;
  shuffleSeed?: string;
}

export interface PlaylistState {
  shuffleSeed: string;
  songIds: string[];
  currentIndex: number;
  loopCount: number;
  lastUpdated: string;
}

export interface PlaylistPersistState {
  playlistType: 'free_rotation' | 'paid';
  fallbackStack: string[];
  fallbackPosition: number;
  stackVersionHash: string | null;
  lastSwitchedAt: string;
  lastCheckpointAt: string;
}

@Injectable()
export class RadioStateService implements OnModuleInit {
  private readonly logger = new Logger(RadioStateService.name);
  private redisAvailable = false;

  async onModuleInit() {
    this.redisAvailable = await isRedisAvailable();
    if (this.redisAvailable) {
      this.logger.log('RadioStateService using Redis for state management');
    } else {
      this.logger.warn('Redis unavailable, falling back to database state');
    }
  }

  /**
   * Get current radio state from Redis (or DB fallback).
   */
  async getCurrentState(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<RadioState | null> {
    if (this.redisAvailable) {
      return this.getStateFromRedis(radioId);
    }
    return this.getStateFromDatabase(radioId);
  }

  /**
   * Set current playing song state.
   */
  async setCurrentState(
    state: RadioState,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (this.redisAvailable) {
      await this.setStateInRedis(state, radioId);
    }
    // Always write to DB as backup for durability
    await this.setStateInDatabase(state, radioId);
  }

  /**
   * Clear current state (when stopping playback).
   */
  async clearState(radioId: string = DEFAULT_RADIO_ID): Promise<void> {
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const keys = redisKeys(radioId);
      await redis.del(keys.CURRENT_STATE);
    }
    await this.clearStateInDatabase(radioId);
  }

  /**
   * Log a play decision for transparency/audit.
   */
  async logPlayDecision(decision: PlayDecision): Promise<void> {
    const supabase = getSupabaseClient();

    try {
      await supabase.from('play_decision_log').insert({
        song_id: decision.songId,
        selected_at: decision.selectedAt,
        selection_reason: decision.selectionReason,
        tier_at_selection: decision.tierAtSelection,
        listener_count: decision.listenerCount,
        weight_score: decision.weightScore,
        competing_songs: decision.competingSongs,
      });
    } catch (error) {
      // Table may not exist yet - log but don't fail
      this.logger.warn(`Failed to log play decision: ${error.message}`);
    }
  }

  /**
   * Get current listener count (for tier system).
   */
  async getListenerCount(radioId: string = DEFAULT_RADIO_ID): Promise<number> {
    if (!this.redisAvailable) return 0;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const count = await redis.get(keys.LISTENER_COUNT);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Increment listener count (called when client connects).
   */
  async incrementListeners(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<number> {
    if (!this.redisAvailable) return 0;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    return await redis.incr(keys.LISTENER_COUNT);
  }

  /**
   * Decrement listener count (called when client disconnects).
   */
  async decrementListeners(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<number> {
    if (!this.redisAvailable) return 0;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const newCount = await redis.decr(keys.LISTENER_COUNT);
    // Don't go below 0
    if (newCount < 0) {
      await redis.set(keys.LISTENER_COUNT, '0');
      return 0;
    }
    return newCount;
  }

  // === Current play (for "song played" notification and per-play analytics) ===

  /**
   * Get current play info (set when an artist song starts; cleared when next track starts).
   */
  async getCurrentPlayInfo(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<{ playId: string; artistId: string; startedAt: string } | null> {
    if (!this.redisAvailable) return null;
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const [playId, artistId, startedAt] = await Promise.all([
      redis.get(keys.CURRENT_PLAY_ID),
      redis.get(keys.CURRENT_PLAY_ARTIST_ID),
      redis.get(keys.CURRENT_PLAY_STARTED_AT),
    ]);
    if (playId && artistId && startedAt) {
      return { playId, artistId, startedAt };
    }
    return null;
  }

  /**
   * Set current play info so we can finalize (update metrics + notify) when next track starts.
   */
  async setCurrentPlayInfo(
    playId: string,
    artistId: string,
    startedAt: string,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.set(keys.CURRENT_PLAY_ID, playId);
    await redis.set(keys.CURRENT_PLAY_ARTIST_ID, artistId);
    await redis.set(keys.CURRENT_PLAY_STARTED_AT, startedAt);
  }

  /**
   * Clear current play info after finalizing.
   */
  async clearCurrentPlayInfo(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.del(keys.CURRENT_PLAY_ID);
    await redis.del(keys.CURRENT_PLAY_ARTIST_ID);
    await redis.del(keys.CURRENT_PLAY_STARTED_AT);
  }

  // === Playlist State Management (for continuous playback) ===

  /**
   * Get or create playlist state for continuous playback.
   */
  async getPlaylistState(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<PlaylistState | null> {
    if (!this.redisAvailable) return null;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const data = await redis.get(keys.PLAYLIST_STATE);

    if (!data) return null;

    try {
      return JSON.parse(data) as PlaylistState;
    } catch (e) {
      this.logger.error(`Failed to parse playlist state: ${e.message}`);
      return null;
    }
  }

  /**
   * Save playlist state (shuffle order, current position).
   */
  async setPlaylistState(
    state: PlaylistState,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.setex(
      keys.PLAYLIST_STATE,
      3600, // 1 hour TTL (refreshed on each update)
      JSON.stringify(state),
    );
  }

  /**
   * Advance to next song in playlist, reshuffle if at end.
   * Returns the new current index and whether we looped.
   */
  async advancePlaylist(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<{ newIndex: number; looped: boolean } | null> {
    const state = await this.getPlaylistState(radioId);
    if (!state || state.songIds.length === 0) {
      return null;
    }

    const nextIndex = state.currentIndex + 1;
    const looped = nextIndex >= state.songIds.length;

    if (looped) {
      // We've completed a full loop - increment count
      state.loopCount++;
      state.currentIndex = 0;
      // New shuffle seed will be set by caller (generates new order)
    } else {
      state.currentIndex = nextIndex;
    }

    state.lastUpdated = new Date().toISOString();
    await this.setPlaylistState(state, radioId);

    return { newIndex: state.currentIndex, looped };
  }

  // === Free Rotation Stack Methods ===

  /**
   * Get the current free rotation stack (shuffled song IDs).
   */
  async getFreeRotationStack(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<string[]> {
    if (!this.redisAvailable) {
      const state = await this.loadPlaylistStateFromDb(radioId);
      return state?.fallbackStack ?? [];
    }

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const data = await redis.get(keys.FREE_ROTATION_STACK);

    if (!data) return [];

    try {
      return JSON.parse(data) as string[];
    } catch (e) {
      this.logger.error(`Failed to parse free rotation stack: ${e.message}`);
      return [];
    }
  }

  /**
   * Set the free rotation stack (after shuffling).
   */
  async setFreeRotationStack(
    songIds: string[],
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) {
      const state = await this.loadPlaylistStateFromDb(radioId);
      const position = state?.fallbackPosition ?? 0;
      await this.saveFullPlaylistState(songIds, position, radioId);
      this.logger.log(
        `Free rotation stack set in DB with ${songIds.length} songs for radio ${radioId}`,
      );
      return;
    }

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    // Set with 24 hour TTL (will be refreshed when stack is refilled)
    await redis.setex(
      keys.FREE_ROTATION_STACK,
      86400, // 24 hours TTL
      JSON.stringify(songIds),
    );

    this.logger.log(
      `Free rotation stack set with ${songIds.length} songs for radio ${radioId}`,
    );
  }

  /**
   * Pop the next song from the free rotation stack.
   * Returns null if stack is empty.
   */
  async popFreeRotationSong(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<string | null> {
    if (!this.redisAvailable) {
      const stack = await this.getFreeRotationStack(radioId);
      if (stack.length === 0) return null;

      const songId = stack.shift()!;
      const state = await this.loadPlaylistStateFromDb(radioId);
      const position = state?.fallbackPosition ?? 0;
      await this.saveFullPlaylistState(stack, position, radioId);
      return songId;
    }

    const stack = await this.getFreeRotationStack(radioId);

    if (stack.length === 0) {
      return null;
    }

    // Pop from the beginning (FIFO after shuffle)
    const songId = stack.shift()!;

    // Save the updated stack
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    if (stack.length > 0) {
      await redis.setex(keys.FREE_ROTATION_STACK, 86400, JSON.stringify(stack));
    } else {
      await redis.del(keys.FREE_ROTATION_STACK);
    }

    return songId;
  }

  /**
   * Check if free rotation stack is empty.
   */
  async isFreeRotationStackEmpty(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<boolean> {
    const stack = await this.getFreeRotationStack(radioId);
    return stack.length === 0;
  }

  /**
   * Clear the free rotation stack (for admin/testing).
   */
  async clearFreeRotationStack(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) {
      const state = await this.loadPlaylistStateFromDb(radioId);
      const position = state?.fallbackPosition ?? 0;
      await this.saveFullPlaylistState([], position, radioId);
      this.logger.log(`Free rotation stack cleared in DB for radio ${radioId}`);
      return;
    }

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.del(keys.FREE_ROTATION_STACK);
    this.logger.log(`Free rotation stack cleared for radio ${radioId}`);
  }

  // === Free Rotation "Played This Cycle" Tracking ===
  // Records which stack IDs have already played in the current pass through the
  // station so that (a) reconcile doesn't re-add them mid-cycle and (b) we only
  // reshuffle into a new random order once every song has played. Redis-only;
  // in the degraded DB-only mode these no-op and the legacy behavior applies.

  /**
   * Get the stack IDs that have already played in the current rotation cycle.
   */
  async getPlayedFreeRotation(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<string[]> {
    if (!this.redisAvailable) return [];

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const data = await redis.get(keys.FREE_ROTATION_PLAYED);

    if (!data) return [];

    try {
      return JSON.parse(data) as string[];
    } catch (e) {
      this.logger.error(`Failed to parse played free rotation set: ${e.message}`);
      return [];
    }
  }

  /**
   * Mark a stack ID as played in the current rotation cycle.
   */
  async addPlayedFreeRotation(
    stackId: string,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;

    const played = await this.getPlayedFreeRotation(radioId);
    if (played.includes(stackId)) return;
    played.push(stackId);

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    // Same 24h TTL as the stack; refreshed each time a song is recorded.
    await redis.setex(
      keys.FREE_ROTATION_PLAYED,
      86400,
      JSON.stringify(played),
    );
  }

  /**
   * Reset the played set at the start of a new rotation cycle.
   */
  async clearPlayedFreeRotation(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.del(keys.FREE_ROTATION_PLAYED);
  }

  // === Playlist Type & Position Persistence ===

  /**
   * Get the current playlist type ('free_rotation' or 'paid').
   * First checks Redis, falls back to Supabase.
   */
  async getCurrentPlaylistType(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<'free_rotation' | 'paid'> {
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const keys = redisKeys(radioId);
      const type = await redis.get(keys.PLAYLIST_TYPE);
      if (type === 'paid' || type === 'free_rotation') {
        return type;
      }
    }

    // Fall back to Supabase
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('radio_playlist_state')
      .select('playlist_type')
      .eq('radio_id', radioId)
      .single();

    const playlistType =
      data?.playlist_type === 'paid' ? 'paid' : 'free_rotation';

    // Cache in Redis for fast access
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const keys = redisKeys(radioId);
      await redis.set(keys.PLAYLIST_TYPE, playlistType);
    }

    return playlistType;
  }

  /**
   * Set the current playlist type (both Redis and Supabase).
   */
  async setCurrentPlaylistType(
    type: 'free_rotation' | 'paid',
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    // Update Redis for fast access
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const keys = redisKeys(radioId);
      await redis.set(keys.PLAYLIST_TYPE, type);
    }

    // Update Supabase for durability (upsert so new radios get a row)
    const supabase = getSupabaseClient();
    await supabase.from('radio_playlist_state').upsert(
      {
        id: radioId,
        radio_id: radioId,
        playlist_type: type,
        last_switched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'radio_id' },
    );

    this.logger.log(`Playlist type set to: ${type} for radio ${radioId}`);
  }

  /**
   * Get the current fallback position from Redis.
   */
  async getFallbackPosition(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<number> {
    if (!this.redisAvailable) {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('radio_playlist_state')
        .select('fallback_position')
        .eq('radio_id', radioId)
        .single();
      return data?.fallback_position || 0;
    }

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const position = await redis.get(keys.FALLBACK_POSITION);
    return position ? parseInt(position, 10) : 0;
  }

  /**
   * Set the fallback position in Redis.
   */
  async setFallbackPosition(
    position: number,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.set(keys.FALLBACK_POSITION, position.toString());
  }

  /**
   * Checkpoint the fallback position.
   * Always updates Redis, syncs to Supabase every CHECKPOINT_INTERVAL songs.
   */
  async checkpointPosition(
    position: number,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const keys = redisKeys(radioId);
      await redis.set(keys.FALLBACK_POSITION, position.toString());

      const count = await redis.incr(keys.SONGS_SINCE_CHECKPOINT);

      if (count >= CHECKPOINT_INTERVAL) {
        await this.syncPositionToSupabase(position, radioId);
        await redis.set(keys.SONGS_SINCE_CHECKPOINT, '0');
        this.logger.log(
          `Checkpoint saved to Supabase at position: ${position} for radio ${radioId}`,
        );
      }
    } else {
      await this.syncPositionToSupabase(position, radioId);
    }
  }

  /**
   * Force sync position to Supabase (used during playlist switches).
   */
  async syncPositionToSupabase(
    position: number,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('radio_playlist_state').upsert(
      {
        id: radioId,
        radio_id: radioId,
        fallback_position: position,
        last_checkpoint_at: new Date().toISOString(),
        songs_played_since_checkpoint: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'radio_id' },
    );
  }

  /**
   * Save full playlist state to Supabase (only when stack content changes).
   */
  async saveFullPlaylistState(
    stack: string[],
    position: number,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    const hash = this.computeStackHash(stack);

    const supabase = getSupabaseClient();
    await supabase.from('radio_playlist_state').upsert(
      {
        id: radioId,
        radio_id: radioId,
        fallback_stack: stack,
        fallback_position: position,
        stack_version_hash: hash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'radio_id' },
    );

    this.logger.log(
      `Full playlist state saved for radio ${radioId}. Stack size: ${stack.length}, Position: ${position}`,
    );
  }

  /**
   * Load playlist state from Supabase.
   */
  async loadPlaylistStateFromDb(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<PlaylistPersistState | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('radio_playlist_state')
      .select('*')
      .eq('radio_id', radioId)
      .single();

    if (error || !data) {
      this.logger.warn(
        `Failed to load playlist state for radio ${radioId}: ${error?.message}`,
      );
      return null;
    }

    return {
      playlistType: data.playlist_type as 'free_rotation' | 'paid',
      fallbackStack: (data.fallback_stack as string[]) || [],
      fallbackPosition: data.fallback_position || 0,
      stackVersionHash: data.stack_version_hash,
      lastSwitchedAt: data.last_switched_at,
      lastCheckpointAt: data.last_checkpoint_at,
    };
  }

  /**
   * Compute MD5 hash of stack content to detect changes.
   */
  private computeStackHash(stack: string[]): string {
    return crypto.createHash('md5').update(stack.join(',')).digest('hex');
  }

  /**
   * Reset the songs-since-checkpoint counter.
   */
  async resetCheckpointCounter(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;

    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.set(keys.SONGS_SINCE_CHECKPOINT, '0');
  }

  // === Private Redis Methods ===

  private async getStateFromRedis(radioId: string): Promise<RadioState | null> {
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    const data = await redis.get(keys.CURRENT_STATE);

    if (!data) return null;

    try {
      return JSON.parse(data) as RadioState;
    } catch (e) {
      this.logger.error(`Failed to parse Redis state: ${e.message}`);
      return null;
    }
  }

  // === DJ Booth: transport, history, mic overlay ===

  async getTransportState(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<RadioTransportState | null> {
    if (!this.redisAvailable) return null;
    const redis = getRedisClient();
    const raw = await redis.get(redisKeys(radioId).TRANSPORT);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RadioTransportState;
    } catch {
      return null;
    }
  }

  async setTransportState(
    state: RadioTransportState,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.setex(
      redisKeys(radioId).TRANSPORT,
      86400,
      JSON.stringify(state),
    );
  }

  async clearTransportState(radioId: string = DEFAULT_RADIO_ID): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.del(redisKeys(radioId).TRANSPORT);
  }

  async getBoothState(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<RadioBoothState | null> {
    if (!this.redisAvailable) return null;
    const redis = getRedisClient();
    const raw = await redis.get(redisKeys(radioId).BOOTH);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RadioBoothState;
    } catch {
      return null;
    }
  }

  async setBoothState(
    state: RadioBoothState,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.setex(redisKeys(radioId).BOOTH, 86400, JSON.stringify(state));
  }

  async clearBoothState(radioId: string = DEFAULT_RADIO_ID): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.del(redisKeys(radioId).BOOTH);
  }

  async getDefaultBoothState(): Promise<RadioBoothState> {
    return {
      micActive: false,
      duckVolume: DEFAULT_DUCK_VOLUME,
      hlsUrl: null,
      sessionId: null,
    };
  }

  async pushHistory(
    entry: RadioHistoryEntry,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    const key = redisKeys(radioId).HISTORY;
    await redis.lpush(key, JSON.stringify(entry));
    await redis.ltrim(key, 0, HISTORY_MAX - 1);
    await redis.expire(key, 86400 * 7);
  }

  async popHistory(
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<RadioHistoryEntry | null> {
    if (!this.redisAvailable) return null;
    const redis = getRedisClient();
    const raw = await redis.lpop(redisKeys(radioId).HISTORY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RadioHistoryEntry;
    } catch {
      return null;
    }
  }

  private async setStateInRedis(
    state: RadioState,
    radioId: string,
  ): Promise<void> {
    const redis = getRedisClient();
    const keys = redisKeys(radioId);
    await redis.setex(
      keys.CURRENT_STATE,
      600, // 10 minutes TTL
      JSON.stringify(state),
    );
  }

  // === Private Database Methods (Fallback) ===

  private async getStateFromDatabase(
    radioId: string,
  ): Promise<RadioState | null> {
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('rotation_queue')
      .select('*')
      .eq('radio_id', radioId)
      .eq('position', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!existing || !existing.song_id) return null;

    // Need to get song duration
    const { data: song } = await supabase
      .from('songs')
      .select('duration_seconds')
      .eq('id', existing.song_id)
      .single();

    const durationSeconds = song?.duration_seconds || 180;

    return {
      songId: existing.song_id,
      startedAt: new Date(existing.played_at).getTime(),
      durationMs: durationSeconds * 1000,
      priorityScore: existing.priority_score || 0,
      isFallback: false,
      isAdminFallback: false,
      playedAt: existing.played_at,
    };
  }

  private async setStateInDatabase(
    state: RadioState,
    radioId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();

    await supabase
      .from('rotation_queue')
      .delete()
      .eq('radio_id', radioId)
      .eq('position', 0);

    await supabase.from('rotation_queue').insert({
      radio_id: radioId,
      song_id: state.songId,
      priority_score: state.priorityScore,
      position: 0,
      played_at: state.playedAt,
    });
  }

  private async clearStateInDatabase(radioId: string): Promise<void> {
    const supabase = getSupabaseClient();

    await supabase
      .from('rotation_queue')
      .delete()
      .eq('radio_id', radioId)
      .eq('position', 0);
  }
}
