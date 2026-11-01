import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getRedisClient, isRedisAvailable } from '../config/redis.config';
import { PushNotificationService } from './push-notification.service';

const DUE_KEY = 'pushes:due';

interface QueuedPush {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Durable scheduled pushes. Jobs sit in a Redis sorted set until they are due,
 * so a restart does not drop a weekly recap that was already queued.
 */
@Injectable()
export class PushQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushQueueService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly push: PushNotificationService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.drain();
    }, 30_000);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(job: Omit<QueuedPush, 'id'>, runAt = Date.now()) {
    const payload: QueuedPush = { ...job, id: randomUUID() };
    if (!(await isRedisAvailable())) {
      await this.push.sendPushNotification(payload);
      return;
    }
    try {
      await getRedisClient().zadd(DUE_KEY, runAt, JSON.stringify(payload));
    } catch (e) {
      this.logger.warn(`Queue write failed, sending now: ${(e as Error).message}`);
      await this.push.sendPushNotification(payload);
    }
  }

  async drain() {
    if (!(await isRedisAvailable())) return;
    let raw: string[] = [];
    try {
      raw = await getRedisClient().zrangebyscore(
        DUE_KEY,
        0,
        Date.now(),
        'LIMIT',
        0,
        25,
      );
    } catch (e) {
      this.logger.warn(`Queue read failed: ${(e as Error).message}`);
      return;
    }
    for (const item of raw) {
      const removed = await getRedisClient().zrem(DUE_KEY, item);
      if (removed !== 1) continue;
      try {
        const job = JSON.parse(item) as QueuedPush;
        await this.push.sendPushNotification(job);
      } catch (e) {
        this.logger.warn(`Queued push failed: ${(e as Error).message}`);
      }
    }
  }
}
