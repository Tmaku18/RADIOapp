import { Module } from '@nestjs/common';
import { ArtistLiveController } from './artist-live.controller';
import { ArtistLiveService } from './artist-live.service';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PushNotificationModule, PaymentsModule],
  controllers: [ArtistLiveController],
  providers: [ArtistLiveService],
  exports: [ArtistLiveService],
})
export class ArtistLiveModule {}
