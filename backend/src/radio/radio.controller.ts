import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { RadioService } from './radio.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { ProspectorYieldService } from './prospector-yield.service';
import { normalizeSongStationId } from './station.constants';

@Controller('radio')
export class RadioController {
  private readonly logger = new Logger(RadioController.name);
  private readonly endpointTimeoutMs = Math.max(
    1000,
    parseInt(process.env.RADIO_ENDPOINT_TIMEOUT_MS || '8000', 10),
  );
  /**
   * Throttles the stale-while-revalidate background refresh. Without this,
   * every poll from every listener triggers a full getCurrentTrack DB pass.
   * With this, at most one refresh per radio per SWR_REFRESH_MIN_MS runs.
   */
  private readonly swrLastRefreshAt = new Map<string, number>();
  private readonly swrInFlight = new Set<string>();
  private readonly SWR_REFRESH_MIN_MS = 30_000;

  constructor(
    private readonly radioService: RadioService,
    private readonly prospectorYieldService: ProspectorYieldService,
  ) {}

  private async withTimeout<T>(
    operation: Promise<T>,
    label: string,
  ): Promise<T> {
    return Promise.race([
      operation,
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out after ${this.endpointTimeoutMs}ms`,
              ),
            ),
          this.endpointTimeoutMs,
        ),
      ),
    ]);
  }

  @Public()
  @Get('current')
  async getCurrentTrack(@Query('radio') radioId?: string) {
    // Normalize so the queue state key and the song scoping agree. Legacy ids
    // ('global', 'default', old ga-* ids) otherwise get their own Redis queue
    // while their songs are picked from the default station.
    const id = normalizeSongStationId(radioId);

    // Stale-while-revalidate: if we have a cached snapshot that still matches
    // the live queue, serve it immediately. Background refresh is throttled per
    // radio to prevent every listener poll from triggering a full DB pass.
    const existing = await this.radioService.getVerifiedCachedCurrentTrack(id);
    if (existing) {
      const now = Date.now();
      const lastRefresh = this.swrLastRefreshAt.get(id) ?? 0;
      if (
        now - lastRefresh >= this.SWR_REFRESH_MIN_MS &&
        !this.swrInFlight.has(id)
      ) {
        this.swrInFlight.add(id);
        this.swrLastRefreshAt.set(id, now);
        this.radioService
          .getCurrentTrackCoalesced(id)
          .catch((e) =>
            this.logger.warn(`Background refresh for ${id} failed: ${e?.message}`),
          )
          .finally(() => this.swrInFlight.delete(id));
      }
      return { ...existing, stale: true };
    }

    try {
      return await this.withTimeout(
        this.radioService.getCurrentTrackCoalesced(id),
        `getCurrentTrack(${id})`,
      );
    } catch (err) {
      this.logger.warn(
        `getCurrentTrack failed: ${err?.message || err}`,
        err?.stack,
      );
      const message = err?.message || 'Radio unavailable';
      const cached = this.radioService.getAnyCachedCurrentTrack(id);
      if (cached) {
        return {
          ...cached,
          no_content: false,
          stale_reason: message,
        };
      }
      return { no_content: true, message };
    }
  }

  @Public()
  @Get('next')
  async getNextTrack(
    @Query('radio') radioId?: string,
    @Query('force') force?: string,
    @Query('after') after?: string,
  ) {
    const id = normalizeSongStationId(radioId);
    const forceAdvance = ['1', 'true', 'yes'].includes(
      (force ?? '').trim().toLowerCase(),
    );
    // Song the caller just finished. Lets the service reject a duplicate
    // advance from a device that is already a track behind.
    const afterSongId = after?.trim() || null;
    try {
      return await this.withTimeout(
        this.radioService.getNextTrack(id, forceAdvance, afterSongId),
        `getNextTrack(${id})`,
      );
    } catch (err) {
      this.logger.warn(
        `getNextTrack failed: ${err?.message || err}`,
        err?.stack,
      );
      const message = err?.message || 'Unable to advance radio queue';
      const cached =
        this.radioService.getCachedCurrentTrack(id) ??
        this.radioService.getAnyCachedCurrentTrack(id);
      if (cached) {
        return {
          ...cached,
          no_content: false,
          stale_reason: message,
        };
      }
      return { no_content: true, message };
    }
  }

  @Post('play')
  async reportPlay(@Body() body: { songId: string; skipped?: boolean }) {
    await this.radioService.reportPlay(body.songId, body.skipped || false);
    return { success: true };
  }

  @Post('heartbeat')
  async heartbeat(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { streamToken?: string; songId: string; timestamp?: string },
  ) {
    const result = await this.prospectorYieldService.recordHeartbeat(
      user.uid,
      body,
    );
    // Reflect this listener in the live count without waiting out the cache TTL.
    if (body.songId) this.radioService.invalidateListenerCount(body.songId);
    return result;
  }

  @Public()
  @Post('presence')
  async presence(
    @Body() body: { streamToken?: string; songId: string; timestamp?: string },
  ) {
    await this.radioService.recordListenerPresence(body);
    return { received: true };
  }

  @Public()
  @Get('peek')
  async peekNextTrack(@Query('radio') radioId?: string) {
    const id = normalizeSongStationId(radioId);
    try {
      return await this.withTimeout(
        this.radioService.peekNextTrack(id),
        `peekNextTrack(${id})`,
      );
    } catch (err) {
      this.logger.warn(
        `peekNextTrack failed: ${err?.message || err}`,
        err?.stack,
      );
      return {
        no_content: true,
        message: err?.message || 'Unable to preview next track',
      };
    }
  }

  @Public()
  @Get('queue')
  async getUpcomingQueue(
    @Query('limit') limit?: string,
    @Query('radio') radioId?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const id = normalizeSongStationId(radioId);
    return this.radioService.getUpcomingQueue(parsedLimit, id);
  }

  @Delete('queue')
  @Roles('admin')
  async clearQueue(@Query('radio') radioId?: string) {
    const id = normalizeSongStationId(radioId);
    return this.radioService.clearQueueState(id);
  }
}
