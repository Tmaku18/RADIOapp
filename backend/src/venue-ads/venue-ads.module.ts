import { Module } from '@nestjs/common';
import { VenueAdsController } from './venue-ads.controller';
import { VenueAdsService } from './venue-ads.service';

@Module({
  controllers: [VenueAdsController],
  providers: [VenueAdsService],
  exports: [VenueAdsService],
})
export class VenueAdsModule {}
