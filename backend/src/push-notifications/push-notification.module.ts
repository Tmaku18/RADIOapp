import { Module } from '@nestjs/common';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { PushQueueService } from './push-queue.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PushNotificationController],
  providers: [PushNotificationService, PushQueueService],
  exports: [PushNotificationService, PushQueueService],
})
export class PushNotificationModule {}
