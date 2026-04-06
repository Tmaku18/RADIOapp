import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

let redisClient: Redis | null = null;
let redisDisabled = false;
const logger = new Logger('RedisConfig');

const PLACEHOLDER_PATTERNS = [
  'replace_if_using',
  'REPLACE_IF_USING',
  'your_redis_url',
  'YOUR_REDIS_URL',
  'changeme',
  'placeholder',
];

function isPlaceholderUrl(url: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => url.includes(p));
}

/**
 * Get or create a Redis client instance.
 * Throws if called when Redis is disabled; callers must check isRedisAvailable first.
 */
export const getRedisClient = (): Redis => {
  if (redisDisabled) {
    throw new Error(
      'Redis is disabled (no valid REDIS_URL). Check isRedisAvailable() before calling.',
    );
  }

  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || '';

    if (!redisUrl || isPlaceholderUrl(redisUrl)) {
      logger.warn(
        'Redis URL is not configured (placeholder or empty). Running without Redis.',
      );
      redisDisabled = true;
      throw new Error('Redis is disabled (no valid REDIS_URL).');
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn('Redis retry limit reached, giving up');
          return null;
        }
        return Math.min(times * 500, 5000);
      },
      reconnectOnError(err) {
        return err.message.includes('READONLY');
      },
    });

    redisClient.on('connect', () => {
      logger.log('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error(`Redis client error: ${err.message}`);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
};

/**
 * Check if Redis is available.
 * Returns false if Redis is not configured or unreachable.
 */
export const isRedisAvailable = async (): Promise<boolean> => {
  if (redisDisabled) return false;
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.warn('Redis is not available, falling back to in-memory');
    redisDisabled = true;
    return false;
  }
};

/**
 * Close Redis connection gracefully.
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.log('Redis connection closed');
  }
};
