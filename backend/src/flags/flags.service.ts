import { Injectable } from '@nestjs/common';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';

const DEFAULTS: Record<string, string> = {
  crossfadeMs: '3000',
  weeklyDigest: 'true',
  degradedPlayback: 'true',
};

/**
 * Runtime flags. Environment values are the default. A Redis hash named
 * `feature_flags` overrides them without a redeploy.
 */
@Injectable()
export class FlagsService {
  async all(): Promise<Record<string, string>> {
    const flags = {
      ...DEFAULTS,
      crossfadeMs: process.env.FEATURE_CROSSFADE_MS || DEFAULTS.crossfadeMs,
      weeklyDigest: process.env.FEATURE_WEEKLY_DIGEST || DEFAULTS.weeklyDigest,
      degradedPlayback:
        process.env.FEATURE_DEGRADED_PLAYBACK || DEFAULTS.degradedPlayback,
    };
    if (!(await isRedisAvailable())) return flags;
    try {
      const stored = await getRedisClient().hgetall('feature_flags');
      return { ...flags, ...stored };
    } catch {
      return flags;
    }
  }

  async set(name: string, value: string) {
    if (!DEFAULTS[name]) return this.all();
    if (await isRedisAvailable()) {
      await getRedisClient().hset('feature_flags', name, value);
    }
    return this.all();
  }
}
