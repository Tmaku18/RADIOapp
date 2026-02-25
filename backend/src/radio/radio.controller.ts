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

@Controller('radio')
export class RadioController {
  private readonly logger = new Logger(RadioController.name);

  constructor(
    private readonly radioService: RadioService,
    private readonly prospectorYieldService: ProspectorYieldService,
  ) {}

  @Public()
  @Get('current')
  async getCurrentTrack() {
    try {
      return await this.radioService.getCurrentTrack();
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
  async getNextTrack() {
    return this.radioService.getNextTrack();
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
  async getUpcomingQueue(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.radioService.getUpcomingQueue(parsedLimit);
  }

  @Delete('queue')
  @Roles('admin')
  async clearQueue() {
    return this.radioService.clearQueueState();
  }
}
