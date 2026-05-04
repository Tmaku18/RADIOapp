import { Module } from '@nestjs/common';
import { ServiceMessagesController } from './service-messages.controller';
import { ServiceMessagesService } from './service-messages.service';
import { NotificationModule } from '../notifications/notification.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';

@Module({
  imports: [
    NotificationModule,
    PushNotificationModule,
    ProNetworkSubscriptionModule,
  ],
  controllers: [ServiceMessagesController],
  providers: [ServiceMessagesService],
  exports: [ServiceMessagesService],
})
export class ServiceMessagesModule {}
