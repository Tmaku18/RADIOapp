import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';
import { ALLOWED_EMOJIS } from './dto/emoji-reaction.dto';
import { ChatService } from './chat.service';

/**
 * Redis-backed emoji aggregation service.
 *
 * Why Redis?
 * - Without Redis, horizontal scaling breaks aggregation
 * - User A on Server 1, User B on Server 2 would see different emoji counts
 * - Redis provides atomic HINCRBY for consistent counting across instances
 *
 * Data Structure: Redis Hash
 * Key: song:{songId}:emojis  (or radio:{radioId}:emojis when no song yet)
 * Fields: { "❤️": count, "🔥": count, ... }
 */
@Injectable()
export class EmojiService {
  private readonly logger = new Logger(EmojiService.name);

  /** Current song per station (set by RadioService on track change). */
  private currentSongByRadio = new Map<string, string>();

  // Rate limiting: 1 emoji per second per user (in-memory, should use Redis in production)
  private lastEmojiTime: Map<string, number> = new Map();

  // Fallback in-memory counters keyed by `${scopeKey}::${emoji}`
  private inMemoryCounters: Map<string, number> = new Map();
  private useRedis = true;

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {
    // Check Redis availability on startup
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    this.useRedis = await isRedisAvailable();
    if (!this.useRedis) {
      this.logger.warn(
        'Redis unavailable, using in-memory emoji counters (not suitable for production)',
      );
    }
  }

  private normalizeRadioId(radioId?: string | null): string {
    const trimmed = radioId?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 64) : 'global';
  }

  /**
   * Set the current song ID (called by RadioService when track changes)
   */
  setCurrentSong(songId: string, radioId: string = 'global') {
    const normalized = this.normalizeRadioId(radioId);
    this.currentSongByRadio.set(normalized, songId);
    // Clear in-memory counters for this station on song change
    const prefix = `song:${songId}::`;
    const radioPrefix = `radio:${normalized}::`;
    for (const key of [...this.inMemoryCounters.keys()]) {
      if (key.startsWith(prefix) || key.startsWith(radioPrefix)) {
        this.inMemoryCounters.delete(key);
      }
    }
  }

  /**
   * Get the current song ID for a station (legacy helper — default radio).
   */
  getCurrentSongId(radioId: string = 'global'): string | null {
    return this.currentSongByRadio.get(this.normalizeRadioId(radioId)) ?? null;
  }

  private counterScope(radioId: string): { redisKey: string; songId: string } {
    const songId = this.currentSongByRadio.get(radioId);
    if (songId) {
      return { redisKey: `song:${songId}:emojis`, songId };
    }
    // Chat Room / station with no track handoff yet — still accept reactions.
    return {
      redisKey: `radio:${radioId}:emojis`,
      songId: `radio:${radioId}`,
    };
  }

  /**
   * Add an emoji reaction from a user
   * Returns true if accepted, false if rate limited or invalid
   */
  async addReaction(
    userId: string,
    emoji: string,
    radioId?: string,
  ): Promise<boolean> {
    // iOS/Flutter may send ❤ without the emoji presentation selector.
    const normalizedEmoji = emoji === '❤' ? '❤️' : emoji;
    const normalizedRadioId = this.normalizeRadioId(radioId);

    // Validate emoji is in allowlist
    if (!ALLOWED_EMOJIS.includes(normalizedEmoji)) {
      this.logger.warn(`Invalid emoji rejected: ${emoji} from user ${userId}`);
      return false;
    }

    // Rate limit check: 1 emoji per second per user
    const lastTime = this.lastEmojiTime.get(userId);
    const now = Date.now();
    if (lastTime && now - lastTime < 1000) {
      return false; // Too fast, silently reject
    }
    this.lastEmojiTime.set(userId, now);

    // Clean up old rate limit entries periodically
    if (Math.random() < 0.01) {
      this.cleanupRateLimits();
    }

    const { redisKey } = this.counterScope(normalizedRadioId);

    try {
      if (this.useRedis) {
        try {
          const redis = getRedisClient();
          await redis.hincrby(redisKey, normalizedEmoji, 1);
          return true;
        } catch (redisError) {
          this.useRedis = false;
          this.logger.warn(
            `Redis emoji write failed, falling back to memory: ${(redisError as Error).message}`,
          );
        }
      }

      const key = `${redisKey}::${normalizedEmoji}`;
      this.inMemoryCounters.set(
        key,
        (this.inMemoryCounters.get(key) || 0) + 1,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to add emoji reaction: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast aggregated emoji counts every 2 seconds for every active station.
   */
  @Cron('*/2 * * * * *')
  async broadcastEmojiCounts() {
    const radioIds = new Set<string>([
      ...this.currentSongByRadio.keys(),
      'global',
    ]);

    // Also flush any in-memory radio:* scopes that received taps before a song set.
    for (const key of this.inMemoryCounters.keys()) {
      const match = /^radio:([^:]+):emojis::/.exec(key);
      if (match?.[1]) radioIds.add(match[1]);
    }

    for (const radioId of radioIds) {
      await this.broadcastForRadio(radioId);
    }
  }

  private async broadcastForRadio(radioId: string) {
    const { redisKey, songId } = this.counterScope(radioId);

    try {
      let counts: Record<string, string>;

      if (this.useRedis) {
        try {
          const redis = getRedisClient();
          counts = await redis.hgetall(redisKey);
          if (!counts || Object.keys(counts).length === 0) return;
          await redis.del(redisKey);
        } catch (redisError) {
          this.useRedis = false;
          this.logger.warn(
            `Redis emoji read failed, falling back to memory: ${(redisError as Error).message}`,
          );
          return;
        }
      } else {
        const prefix = `${redisKey}::`;
        const entries = [...this.inMemoryCounters.entries()].filter(([k]) =>
          k.startsWith(prefix),
        );
        if (entries.length === 0) return;

        counts = {};
        for (const [key, count] of entries) {
          counts[key.slice(prefix.length)] = count.toString();
          this.inMemoryCounters.delete(key);
        }
      }

      await this.chatService.broadcastEmojiBurst(radioId, {
        songId,
        emojis: counts,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(
        `Broadcasted emoji burst on radio-chat:${radioId}: ${JSON.stringify(counts)}`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast emoji counts: ${error.message}`);
    }
  }

  /**
   * Clean up old rate limit entries
   */
  private cleanupRateLimits() {
    const now = Date.now();
    const expiry = 60000; // 1 minute

    for (const [userId, time] of this.lastEmojiTime.entries()) {
      if (now - time > expiry) {
        this.lastEmojiTime.delete(userId);
      }
    }
  }
}
