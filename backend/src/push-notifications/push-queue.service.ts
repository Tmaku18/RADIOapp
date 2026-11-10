import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { isRedisAvailable, redisConnectionFamily } from '../config/redis.config';
import { PushNotificationService } from './push-notification.service';

const QUEUE_NAME = 'scheduled-pushes';

export interface QueuedPush {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

function connectionFromUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const family = redisConnectionFamily(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    ...(family ? { family } : {}),
    maxRetriesPerRequest: null,
  };
}

/**
 * Durable pushes. BullMQ keeps the job in Redis until a worker sends it, so a
 * restart does not drop a weekly recap that was already queued.
 */
@Injectable()
export class PushQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushQueueService.name);
  private queue: Queue<QueuedPush> | null = null;
  private worker: Worker<QueuedPush> | null = null;

  constructor(private readonly push: PushNotificationService) {}

  async onModuleInit() {
    const url = process.env.REDIS_URL?.trim();
    if (!url || !(await isRedisAvailable())) {
      this.logger.warn('Push queue will send immediately until Redis is up.');
      return;
    }
    const connection = connectionFromUrl(url);
    this.queue = new Queue<QueuedPush>(QUEUE_NAME, { connection });
    this.worker = new Worker<QueuedPush>(
      QUEUE_NAME,
      async (job) => {
        await this.push.sendPushNotification(job.data);
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Push job ${job?.id ?? '?'} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(job: QueuedPush, runAt = Date.now()) {
    const delay = Math.max(0, runAt - Date.now());
    if (!this.queue) {
      await this.push.sendPushNotification(job);
      return;
    }
    await this.queue.add('push', job, {
      delay,
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    });
  }
}
