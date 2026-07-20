import { Controller, Get, Query } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('app')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /** Public version check used by the mobile app on launch. */
  @Public()
  @Get('version')
  async getVersion(@Query('platform') platform?: string) {
    const normalized =
      platform === 'ios' || platform === 'android' ? platform : 'android';
    return this.appVersionService.getLatestForPlatform(normalized);
  }
}
