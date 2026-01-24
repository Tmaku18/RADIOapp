import { Module } from '@nestjs/common';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PushNotificationController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
