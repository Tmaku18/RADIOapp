import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';
import { getSupabaseClient } from '../config/supabase.config';
import * as crypto from 'crypto';

/**
 * Redis key structure:
 * - radio:current -> JSON RadioState
 * - radio:play_decision_log -> Recent decisions (for audit)
 * - radio:playlist_type -> 'free_rotation' | 'paid'
 * - radio:fallback_position -> current position in free rotation stack
 * - radio:songs_since_checkpoint -> counter for checkpoint frequency
 */
const REDIS_KEYS = {
  CURRENT_STATE: 'radio:current',
  LISTENER_COUNT: 'radio:listeners',
  PRIME_TIME_ACTIVE: 'radio:prime_time',
  PLAYLIST_STATE: 'radio:playlist',
  FREE_ROTATION_STACK: 'radio:free_rotation_stack',
  PLAYLIST_TYPE: 'radio:playlist_type',
  FALLBACK_POSITION: 'radio:fallback_position',
  SONGS_SINCE_CHECKPOINT: 'radio:songs_since_checkpoint',
  CURRENT_PLAY_ID: 'radio:current_play_id',
  CURRENT_PLAY_ARTIST_ID: 'radio:current_play_artist_id',
  CURRENT_PLAY_STARTED_AT: 'radio:current_play_started_at',
} as const;

// Checkpoint frequency for saving to Supabase
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL || '5', 10);

export interface RadioState {
  songId: string;
  startedAt: number;  // Unix timestamp ms
  durationMs: number;
  priorityScore: number;
  isFallback: boolean;
  isAdminFallback: boolean;
  playedAt: string;   // ISO string for compatibility
}

export interface PlayDecision {
  songId: string;
  selectedAt: string;
  selectionReason: 'credits' | 'trial' | 'opt_in' | 'admin_fallback' | 'fallback';
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
  async getCurrentState(): Promise<RadioState | null> {
    if (this.redisAvailable) {
      return this.getStateFromRedis();
    }
    return this.getStateFromDatabase();
  }

  /**
   * Set current playing song state.
   */
  async setCurrentState(state: RadioState): Promise<void> {
    if (this.redisAvailable) {
      await this.setStateInRedis(state);
    }
    // Always write to DB as backup for durability
    await this.setStateInDatabase(state);
  }

  /**
   * Clear current state (when stopping playback).
   */
  async clearState(): Promise<void> {
    if (this.redisAvailable) {
      const redis = getRedisClient();
      await redis.del(REDIS_KEYS.CURRENT_STATE);
    }
    await this.clearStateInDatabase();
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
  async getListenerCount(): Promise<number> {
    if (!this.redisAvailable) return 0;
    
    const redis = getRedisClient();
    const count = await redis.get(REDIS_KEYS.LISTENER_COUNT);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Increment listener count (called when client connects).
   */
  async incrementListeners(): Promise<number> {
    if (!this.redisAvailable) return 0;
    
    const redis = getRedisClient();
    return await redis.incr(REDIS_KEYS.LISTENER_COUNT);
  }

  /**
   * Decrement listener count (called when client disconnects).
   */
  async decrementListeners(): Promise<number> {
    if (!this.redisAvailable) return 0;
    
    const redis = getRedisClient();
    const newCount = await redis.decr(REDIS_KEYS.LISTENER_COUNT);
    // Don't go below 0
    if (newCount < 0) {
      await redis.set(REDIS_KEYS.LISTENER_COUNT, '0');
      return 0;
    }
    return newCount;
  }

  // === Current play (for "song played" notification and per-play analytics) ===

  /**
   * Get current play info (set when an artist song starts; cleared when next track starts).
   */
  async getCurrentPlayInfo(): Promise<{ playId: string; artistId: string; startedAt: string } | null> {
    if (!this.redisAvailable) return null;
    const redis = getRedisClient();
    const [playId, artistId, startedAt] = await Promise.all([
      redis.get(REDIS_KEYS.CURRENT_PLAY_ID),
      redis.get(REDIS_KEYS.CURRENT_PLAY_ARTIST_ID),
      redis.get(REDIS_KEYS.CURRENT_PLAY_STARTED_AT),
    ]);
    if (playId && artistId && startedAt) {
      return { playId, artistId, startedAt };
    }
    return null;
  }

  /**
   * Set current play info so we can finalize (update metrics + notify) when next track starts.
   */
  async setCurrentPlayInfo(playId: string, artistId: string, startedAt: string): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.set(REDIS_KEYS.CURRENT_PLAY_ID, playId);
    await redis.set(REDIS_KEYS.CURRENT_PLAY_ARTIST_ID, artistId);
    await redis.set(REDIS_KEYS.CURRENT_PLAY_STARTED_AT, startedAt);
  }

  /**
   * Clear current play info after finalizing.
   */
  async clearCurrentPlayInfo(): Promise<void> {
    if (!this.redisAvailable) return;
    const redis = getRedisClient();
    await redis.del(REDIS_KEYS.CURRENT_PLAY_ID);
    await redis.del(REDIS_KEYS.CURRENT_PLAY_ARTIST_ID);
    await redis.del(REDIS_KEYS.CURRENT_PLAY_STARTED_AT);
  }

  // === Playlist State Management (for continuous playback) ===

  /**
   * Get or create playlist state for continuous playback.
   */
  async getPlaylistState(): Promise<PlaylistState | null> {
    if (!this.redisAvailable) return null;
    
    const redis = getRedisClient();
    const data = await redis.get(REDIS_KEYS.PLAYLIST_STATE);
    
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
  async setPlaylistState(state: PlaylistState): Promise<void> {
    if (!this.redisAvailable) return;
    
    const redis = getRedisClient();
    await redis.setex(
      REDIS_KEYS.PLAYLIST_STATE,
      3600, // 1 hour TTL (refreshed on each update)
      JSON.stringify(state)
    );
  }

  /**
   * Advance to next song in playlist, reshuffle if at end.
   * Returns the new current index and whether we looped.
   */
  async advancePlaylist(): Promise<{ newIndex: number; looped: boolean } | null> {
    const state = await this.getPlaylistState();
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
    await this.setPlaylistState(state);

    return { newIndex: state.currentIndex, looped };
  }

  // === Free Rotation Stack Methods ===

  /**
   * Get the current free rotation stack (shuffled song IDs).
   */
  async getFreeRotationStack(): Promise<string[]> {
    if (!this.redisAvailable) return [];
    
    const redis = getRedisClient();
    const data = await redis.get(REDIS_KEYS.FREE_ROTATION_STACK);
    
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
  async setFreeRotationStack(songIds: string[]): Promise<void> {
    if (!this.redisAvailable) return;
    
    const redis = getRedisClient();
    // Set with 24 hour TTL (will be refreshed when stack is refilled)
    await redis.setex(
      REDIS_KEYS.FREE_ROTATION_STACK,
      86400, // 24 hours TTL
      JSON.stringify(songIds)
    );
    
    this.logger.log(`Free rotation stack set with ${songIds.length} songs`);
  }

  /**
   * Pop the next song from the free rotation stack.
   * Returns null if stack is empty.
   */
  async popFreeRotationSong(): Promise<string | null> {
    if (!this.redisAvailable) return null;
    
    const stack = await this.getFreeRotationStack();
    
    if (stack.length === 0) {
      return null;
    }
    
    // Pop from the beginning (FIFO after shuffle)
    const songId = stack.shift()!;
    
    // Save the updated stack
    const redis = getRedisClient();
    if (stack.length > 0) {
      await redis.setex(
        REDIS_KEYS.FREE_ROTATION_STACK,
        86400,
        JSON.stringify(stack)
      );
    } else {
      // Stack is now empty, delete the key
      await redis.del(REDIS_KEYS.FREE_ROTATION_STACK);
    }
    
    return songId;
  }

  /**
   * Check if free rotation stack is empty.
   */
  async isFreeRotationStackEmpty(): Promise<boolean> {
    const stack = await this.getFreeRotationStack();
    return stack.length === 0;
  }

  /**
   * Clear the free rotation stack (for admin/testing).
   */
  async clearFreeRotationStack(): Promise<void> {
    if (!this.redisAvailable) return;
    
    const redis = getRedisClient();
    await redis.del(REDIS_KEYS.FREE_ROTATION_STACK);
    this.logger.log('Free rotation stack cleared');
  }

  // === Playlist Type & Position Persistence ===

  /**
   * Get the current playlist type ('free_rotation' or 'paid').
   * First checks Redis, falls back to Supabase.
   */
  async getCurrentPlaylistType(): Promise<'free_rotation' | 'paid'> {
    if (this.redisAvailable) {
      const redis = getRedisClient();
      const type = await redis.get(REDIS_KEYS.PLAYLIST_TYPE);
      if (type === 'paid' || type === 'free_rotation') {
        return type;
      }
    }
    
    // Fall back to Supabase
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('radio_playlist_state')
      .select('playlist_type')
      .eq('id', 'global')
      .single();
    
    const playlistType = (data?.playlist_type === 'paid' ? 'paid' : 'free_rotation') as 'free_rotation' | 'paid';
    
    // Cache in Redis for fast access
    if (this.redisAvailable) {
      const redis = getRedisClient();
      await redis.set(REDIS_KEYS.PLAYLIST_TYPE, playlistType);
    }
    
    return playlistType;
  }

  /**
   * Set the current playlist type (both Redis and Supabase).
   */
  async setCurrentPlaylistType(type: 'free_rotation' | 'paid'): Promise<void> {
    // Update Redis for fast access
    if (this.redisAvailable) {
      const redis = getRedisClient();
      await redis.set(REDIS_KEYS.PLAYLIST_TYPE, type);
    }
    
    // Update Supabase for durability
    const supabase = getSupabaseClient();
    await supabase
      .from('radio_playlist_state')
      .update({
        playlist_type: type,
        last_switched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');
    
    this.logger.log(`Playlist type set to: ${type}`);
  }

  /**
   * Get the current fallback position from Redis.
   */
  async getFallbackPosition(): Promise<number> {
    if (!this.redisAvailable) {
      // Fall back to Supabase
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('radio_playlist_state')
        .select('fallback_position')
        .eq('id', 'global')
        .single();
      return data?.fallback_position || 0;
    }
    
    const redis = getRedisClient();
    const position = await redis.get(REDIS_KEYS.FALLBACK_POSITION);
    return position ? parseInt(position, 10) : 0;
  }

  /**
   * Set the fallback position in Redis.
   */
  async setFallbackPosition(position: number): Promise<void> {
    if (!this.redisAvailable) return;
    
    const redis = getRedisClient();
    await redis.set(REDIS_KEYS.FALLBACK_POSITION, position.toString());
  }

  /**
   * Checkpoint the fallback position.
   * Always updates Redis, syncs to Supabase every CHECKPOINT_INTERVAL songs.
   */
  async checkpointPosition(position: number): Promise<void> {
    // Always update Redis (fast)
    if (this.redisAvailable) {
      const redis = getRedisClient();
      await redis.set(REDIS_KEYS.FALLBACK_POSITION, position.toString());
      
      // Increment songs-since-checkpoint counter
      const count = await redis.incr(REDIS_KEYS.SONGS_SINCE_CHECKPOINT);
      
      // Every CHECKPOINT_INTERVAL songs, sync to Supabase (durable)
      if (count >= CHECKPOINT_INTERVAL) {
        await this.syncPositionToSupabase(position);
        await redis.set(REDIS_KEYS.SONGS_SINCE_CHECKPOINT, '0');
        this.logger.log(`Checkpoint saved to Supabase at position: ${position}`);
      }
    } else {
      // No Redis - always write to Supabase
      await this.syncPositionToSupabase(position);
    }
  }

  /**
   * Force sync position to Supabase (used during playlist switches).
   */
  async syncPositionToSupabase(position: number): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('radio_playlist_state')
      .update({
        fallback_position: position,
        last_checkpoint_at: new Date().toISOString(),
        songs_played_since_checkpoint: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');
  }

  /**
   * Save full playlist state to Supabase (only when stack content changes).
   * Includes stack, position, and hash.
   */
  async saveFullPlaylistState(stack: string[], position: number): Promise<void> {
    const hash = this.computeStackHash(stack);
    
    const supabase = getSupabaseClient();
    await supabase
      .from('radio_playlist_state')
      .update({
        fallback_stack: stack,
        fallback_position: position,
        stack_version_hash: hash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'global');
    
    this.logger.log(`Full playlist state saved. Stack size: ${stack.length}, Position: ${position}`);
  }

  /**
   * Load playlist state from Supabase.
   */
  async loadPlaylistStateFromDb(): Promise<PlaylistPersistState | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('radio_playlist_state')
      .select('*')
      .eq('id', 'global')
      .single();
    
    if (error || !data) {
      this.logger.warn(`Failed to load playlist state: ${error?.message}`);
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
  async resetCheckpointCounter(): Promise<void> {
    if (!this.redisAvailable) return;
    
    const redis = getRedisClient();
    await redis.set(REDIS_KEYS.SONGS_SINCE_CHECKPOINT, '0');
  }

  // === Private Redis Methods ===

  private async getStateFromRedis(): Promise<RadioState | null> {
    const redis = getRedisClient();
    const data = await redis.get(REDIS_KEYS.CURRENT_STATE);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as RadioState;
    } catch (e) {
      this.logger.error(`Failed to parse Redis state: ${e.message}`);
      return null;
    }
  }

  private async setStateInRedis(state: RadioState): Promise<void> {
    const redis = getRedisClient();
    
    // Set with expiration slightly longer than max song duration (10 min)
    await redis.setex(
      REDIS_KEYS.CURRENT_STATE,
      600, // 10 minutes TTL
      JSON.stringify(state)
    );
  }

  // === Private Database Methods (Fallback) ===

  private async getStateFromDatabase(): Promise<RadioState | null> {
    const supabase = getSupabaseClient();
    
    const { data: existing } = await supabase
      .from('rotation_queue')
      .select('*')
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

  private async setStateInDatabase(state: RadioState): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Clear existing
    await supabase
      .from('rotation_queue')
      .delete()
      .eq('position', 0);

    // Insert new state
    await supabase
      .from('rotation_queue')
      .insert({
        song_id: state.songId,
        priority_score: state.priorityScore,
        position: 0,
        played_at: state.playedAt,
      });
  }

  private async clearStateInDatabase(): Promise<void> {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('rotation_queue')
      .delete()
      .eq('position', 0);
  }
}
