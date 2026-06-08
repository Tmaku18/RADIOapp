import Redis from 'ioredis';

let client: Redis | null = null;
let disabled = false;

export function getRedis(): Redis | null {
  if (disabled) return null;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    disabled = true;
    console.warn('[radio-worker] REDIS_URL not set — worker running in no-op mode');
    return null;
  }
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 3 });
    client.on('error', (err) => console.error('[radio-worker] Redis error:', err.message));
  }
  return client;
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/** Port of NestJS emoji flush: persist Redis hash counts to Postgres. */
export async function flushEmojiAggregates(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  const keys = await redis.keys('song:*:emojis');
  let flushed = 0;

  for (const key of keys) {
    const match = /^song:([^:]+):emojis$/.exec(key);
    if (!match) continue;
    const songId = match[1];
    const hash = await redis.hgetall(key);
    if (!Object.keys(hash).length) continue;

    // Best-effort: log flush (full DB persist stays on NestJS until radio module ports).
    console.log('[radio-worker] emoji flush', songId, hash);
    flushed += 1;
  }

  return flushed;
}
