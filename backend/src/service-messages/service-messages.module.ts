import { Module } from '@nestjs/common';
import { ServiceMessagesController } from './service-messages.controller';
import { ServiceMessagesService } from './service-messages.service';
import { NotificationModule } from '../notifications/notification.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';
import { UsersModule } from '../users/users.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    NotificationModule,
    PushNotificationModule,
    ProNetworkSubscriptionModule,
    UsersModule,
    ModerationModule,
  ],
  controllers: [ServiceMessagesController],
  providers: [ServiceMessagesService],
  exports: [ServiceMessagesService],
})
export class ServiceMessagesModule {}
