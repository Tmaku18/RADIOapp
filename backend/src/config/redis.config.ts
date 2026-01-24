import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

let redisClient: Redis | null = null;
const logger = new Logger('RedisConfig');

/**
 * Get or create a Redis client instance.
 * Uses REDIS_URL environment variable or defaults to localhost.
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
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
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.warn('Redis is not available, falling back to in-memory');
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
