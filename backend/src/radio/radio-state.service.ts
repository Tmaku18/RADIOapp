import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';
import { getSupabaseClient } from '../config/supabase.config';

/**
 * Redis key structure:
 * - radio:current -> JSON RadioState
 * - radio:play_decision_log -> Recent decisions (for audit)
 */
const REDIS_KEYS = {
  CURRENT_STATE: 'radio:current',
  LISTENER_COUNT: 'radio:listeners',
  PRIME_TIME_ACTIVE: 'radio:prime_time',
} as const;

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
