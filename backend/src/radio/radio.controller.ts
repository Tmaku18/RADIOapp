import { Controller, Get, Post, Delete, Body, Query } from '@nestjs/common';
import { RadioService } from './radio.service';
import type { CurrentTrackResponse } from './radio.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('radio')
export class RadioController {
  constructor(private readonly radioService: RadioService) {}

  @Public()
  @Get('current')
  async getCurrentTrack(): Promise<CurrentTrackResponse | null> {
    return this.radioService.getCurrentTrack();
  }

  @Get('next')
  async getNextTrack(): Promise<CurrentTrackResponse | null> {
    return this.radioService.getNextTrack();
  }

  @Post('play')
  async reportPlay(@Body() body: { songId: string; skipped?: boolean }) {
    await this.radioService.reportPlay(body.songId, body.skipped || false);
    return { success: true };
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
