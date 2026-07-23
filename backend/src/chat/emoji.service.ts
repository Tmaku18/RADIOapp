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
 * Key: song:{songId}:emojis
 * Fields: { "❤️": count, "🔥": count, ... }
 */
@Injectable()
export class EmojiService {
  private readonly logger = new Logger(EmojiService.name);

  // Current song being played (set by RadioService)
  private currentSongId: string | null = null;
  /** Station channel suffix — must match chat clients (`radio-chat:{radioId}`). */
  private currentRadioId: string = 'global';

  // Rate limiting: 1 emoji per second per user (in-memory, should use Redis in production)
  private lastEmojiTime: Map<string, number> = new Map();

  // Fallback in-memory counter when Redis is unavailable
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

  /**
   * Set the current song ID (called by RadioService when track changes)
   */
  setCurrentSong(songId: string, radioId: string = 'global') {
    this.currentSongId = songId;
    const normalized = radioId?.trim();
    this.currentRadioId =
      normalized && normalized.length > 0 ? normalized.slice(0, 64) : 'global';
    // Clear in-memory counters on song change
    this.inMemoryCounters.clear();
  }

  /**
   * Get the current song ID
   */
  getCurrentSongId(): string | null {
    return this.currentSongId;
  }

  /**
   * Add an emoji reaction from a user
   * Returns true if accepted, false if rate limited or invalid
   */
  async addReaction(userId: string, emoji: string): Promise<boolean> {
    // iOS/Flutter may send ❤ without the emoji presentation selector.
    const normalizedEmoji = emoji === '❤' ? '❤️' : emoji;

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

    if (!this.currentSongId) {
      this.logger.warn(
        `Emoji rejected — no current song (user=${userId}, emoji=${normalizedEmoji})`,
      );
      return false; // No song playing
    }

    try {
      if (this.useRedis) {
        // Atomic increment in Redis
        const redis = getRedisClient();
        await redis.hincrby(
          `song:${this.currentSongId}:emojis`,
          normalizedEmoji,
          1,
        );
      } else {
        // Fallback to in-memory
        const key = normalizedEmoji;
        this.inMemoryCounters.set(
          key,
          (this.inMemoryCounters.get(key) || 0) + 1,
        );
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to add emoji reaction: ${error.message}`);
      return false;
    }
  }

  /**
   * Broadcast aggregated emoji counts every 2 seconds
   * Cron pattern: "star/2 * * * * *" = every 2 seconds
   */
  @Cron('*/2 * * * * *')
  async broadcastEmojiCounts() {
    if (!this.currentSongId) return;

    try {
      let counts: Record<string, string>;

      if (this.useRedis) {
        const redis = getRedisClient();
        const key = `song:${this.currentSongId}:emojis`;

        // Get all emoji counts
        counts = await redis.hgetall(key);

        // Skip if no emojis
        if (!counts || Object.keys(counts).length === 0) return;

        // Atomic reset after reading
        await redis.del(key);
      } else {
        // Fallback to in-memory
        if (this.inMemoryCounters.size === 0) return;

        counts = {};
        this.inMemoryCounters.forEach((count, emoji) => {
          counts[emoji] = count.toString();
        });

        // Reset counters
        this.inMemoryCounters.clear();
      }

      // Same persistent channel chat clients use (`radio-chat:{radioId}`).
      await this.chatService.broadcastEmojiBurst(this.currentRadioId, {
        songId: this.currentSongId,
        emojis: counts, // { "❤️": "5", "🔥": "3" }
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(
        `Broadcasted emoji burst on radio-chat:${this.currentRadioId}: ${JSON.stringify(counts)}`,
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
