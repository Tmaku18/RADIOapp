import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

let redisClient: Redis | null = null;
let redisDisabled = false;
let errorLogCount = 0;
const MAX_ERROR_LOGS = 5;
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

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid URL)';
  }
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

    logger.log(`Connecting to Redis at ${redactUrl(redisUrl)}`);

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
      errorLogCount = 0;
      logger.log('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.log('Redis client ready');
    });

    redisClient.on('error', (err) => {
      if (errorLogCount < MAX_ERROR_LOGS) {
        logger.error(`Redis client error: ${err.message}`);
        errorLogCount++;
        if (errorLogCount === MAX_ERROR_LOGS) {
          logger.warn('Suppressing further Redis error logs');
        }
      }
    });

    redisClient.on('close', () => {
      if (errorLogCount < MAX_ERROR_LOGS) {
        logger.warn('Redis connection closed');
      }
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
