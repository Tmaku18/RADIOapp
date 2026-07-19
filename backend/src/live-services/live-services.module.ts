import { Module } from '@nestjs/common';
import {
  LiveServicesController,
  ArtistFollowsController,
} from './live-services.controller';
import { LiveServicesService } from './live-services.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [LiveServicesController, ArtistFollowsController],
  providers: [LiveServicesService],
  exports: [LiveServicesService],
})
export class LiveServicesModule {}
