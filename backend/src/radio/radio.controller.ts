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

  constructor(
    private readonly radioService: RadioService,
    private readonly prospectorYieldService: ProspectorYieldService,
  ) {}

  @Public()
  @Get('current')
  async getCurrentTrack(@Query('radio') radioId?: string) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    try {
      return await this.radioService.getCurrentTrack(id);
    } catch (err) {
      this.logger.warn(
        `getCurrentTrack failed: ${err?.message || err}`,
        err?.stack,
      );
      const message = err?.message || 'Radio unavailable';
      return { no_content: true, message };
    }
  }

  @Public()
  @Get('next')
  async getNextTrack(@Query('radio') radioId?: string) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.radioService.getNextTrack(id);
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

  @Get('queue')
  async getUpcomingQueue(@Query('limit') limit?: string, @Query('radio') radioId?: string) {
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
