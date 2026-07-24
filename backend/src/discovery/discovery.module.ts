import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UploadsModule } from '../uploads/uploads.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';
import { UsersModule } from '../users/users.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';

@Module({
  imports: [
    UploadsModule,
    ProNetworkSubscriptionModule,
    UsersModule,
    PushNotificationModule,
  ],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
