import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Events pushed to listeners of a station. The wire format stays
 * `dj_booth_event` on channel `dj-booth:{stationId}` because installed app
 * builds subscribe to those names — see `StationEventsService` (mobile) and
 * `dj-booth-listener.ts` (web).
 */
export type StationRealtimeEvent =
  | { type: 'transport_pause'; positionSeconds: number }
  | { type: 'transport_play'; positionSeconds: number }
  | {
      type: 'mic_on';
      duckVolume: number;
      hlsUrl: string | null;
      whepUrl: string | null;
    }
  | { type: 'mic_off' }
  | { type: 'duck_volume'; duckVolume: number }
  | {
      type: 'soundboard_play';
      clipId: string;
      clipUrl: string;
      clipName: string;
      durationSeconds: number;
    }
  | { type: 'queue_updated' };

@Injectable()
export class StationRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StationRealtimeService.name);
  private readonly channels = new Map<string, RealtimeChannel>();
  private readonly channelReady = new Map<string, boolean>();
  private readonly channelReadyPromises = new Map<string, Promise<void>>();
  private readonly channelReadyResolvers = new Map<string, () => void>();

  async onModuleInit() {
    await this.ensureChannel('global');
  }

  async onModuleDestroy() {
    for (const [, channel] of this.channels.entries()) {
      await channel.unsubscribe();
    }
    this.channels.clear();
    this.channelReady.clear();
    this.channelReadyPromises.clear();
    this.channelReadyResolvers.clear();
  }

  private channelNameFor(stationId: string): string {
    return `dj-booth:${stationId.trim().slice(0, 64)}`;
  }

  private async ensureChannel(stationId: string): Promise<void> {
    const key = stationId.trim();
    if (this.channels.has(key)) return;

    const supabase = getSupabaseClient();
    const channelName = this.channelNameFor(key);
    const channel = supabase.channel(channelName);

    this.channelReady.set(key, false);
    this.channelReadyPromises.set(
      key,
      new Promise((resolve) => {
        this.channelReadyResolvers.set(key, resolve);
      }),
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.channelReady.set(key, true);
        this.channelReadyResolvers.get(key)?.();
        this.logger.log(`DJ booth channel ready: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.channelReady.set(key, false);
      } else if (status === 'CLOSED') {
        this.channelReady.set(key, false);
        this.channels.delete(key);
      }
    });

    this.channels.set(key, channel);
  }

  private async waitForChannel(stationId: string, timeoutMs = 5000): Promise<boolean> {
    const key = stationId.trim();
    await this.ensureChannel(key);
    if (this.channelReady.get(key)) return true;
    const readyPromise = this.channelReadyPromises.get(key);
    if (!readyPromise) return false;
    try {
      await Promise.race([
        readyPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async broadcast(stationId: string, event: StationRealtimeEvent): Promise<void> {
    const key = stationId.trim();
    const ready = await this.waitForChannel(key);
    if (!ready) {
      this.logger.warn(`DJ booth channel not ready for ${key}`);
      return;
    }
    const channel = this.channels.get(key);
    if (!channel) return;
    try {
      await channel.send({
        type: 'broadcast',
        event: 'dj_booth_event',
        payload: event,
      });
    } catch (e) {
      this.logger.error(
        `DJ booth broadcast failed: ${(e as Error)?.message ?? e}`,
      );
    }
  }
}
