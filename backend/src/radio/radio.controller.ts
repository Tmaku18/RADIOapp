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
import { DEFAULT_RADIO_ID } from './radio-state.service';

@Controller('radio')
export class RadioController {
  private readonly logger = new Logger(RadioController.name);
  private readonly endpointTimeoutMs = Math.max(
    1000,
    parseInt(process.env.RADIO_ENDPOINT_TIMEOUT_MS || '8000', 10),
  );

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
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    try {
      return await this.withTimeout(
        this.radioService.getCurrentTrack(id),
        `getCurrentTrack(${id})`,
      );
    } catch (err) {
      this.logger.warn(
        `getCurrentTrack failed: ${err?.message || err}`,
        err?.stack,
      );
      const message = err?.message || 'Radio unavailable';
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

  @Public()
  @Get('next')
  async getNextTrack(
    @Query('radio') radioId?: string,
    @Query('force') force?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const forceAdvance = ['1', 'true', 'yes'].includes(
      (force ?? '').trim().toLowerCase(),
    );
    try {
      return await this.withTimeout(
        this.radioService.getNextTrack(id, forceAdvance),
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
    return this.prospectorYieldService.recordHeartbeat(user.uid, body);
  }

  @Public()
  @Post('presence')
  async presence(
    @Body() body: { streamToken?: string; songId: string; timestamp?: string },
  ) {
    await this.radioService.recordListenerPresence(body);
    return { received: true };
  }

  @Get('queue')
  async getUpcomingQueue(
    @Query('limit') limit?: string,
    @Query('radio') radioId?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.radioService.getUpcomingQueue(parsedLimit, id);
  }

  @Delete('queue')
  @Roles('admin')
  async clearQueue(@Query('radio') radioId?: string) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.radioService.clearQueueState(id);
  }
}
