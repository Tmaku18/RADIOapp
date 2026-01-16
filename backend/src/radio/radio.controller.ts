import { Controller, Get, Post, Body } from '@nestjs/common';
import { RadioService } from './radio.service';

@Controller('radio')
export class RadioController {
  constructor(private readonly radioService: RadioService) {}

  @Get('current')
  async getCurrentTrack() {
    return this.radioService.getCurrentTrack();
  }

  @Get('next')
  async getNextTrack() {
    return this.radioService.getNextTrack();
  }

  @Post('play')
  async reportPlay(@Body() body: { songId: string; skipped?: boolean }) {
    await this.radioService.reportPlay(body.songId, body.skipped || false);
    return { success: true };
  }
}
