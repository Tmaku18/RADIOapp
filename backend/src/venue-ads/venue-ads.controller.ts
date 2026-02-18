import { Controller, Get, Query } from '@nestjs/common';
import { VenueAdsService } from './venue-ads.service';

@Controller('venue-ads')
export class VenueAdsController {
  constructor(private readonly venueAds: VenueAdsService) {}

  @Get('current')
  getCurrent(@Query('stationId') stationId?: string) {
    return this.venueAds.getCurrentAd(stationId ?? 'global');
  }
}
