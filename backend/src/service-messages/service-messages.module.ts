import { Module } from '@nestjs/common';
import { ServiceMessagesController } from './service-messages.controller';
import { ServiceMessagesService } from './service-messages.service';
import { NotificationModule } from '../notifications/notification.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';

@Module({
  imports: [NotificationModule, PushNotificationModule],
  controllers: [ServiceMessagesController],
  providers: [ServiceMessagesService],
  exports: [ServiceMessagesService],
})
export class ServiceMessagesModule {}
