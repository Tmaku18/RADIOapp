import { Module } from '@nestjs/common';
import { BrowseController } from './browse.controller';
import { BrowseService } from './browse.service';
import { NotificationModule } from '../notifications/notification.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';

@Module({
  imports: [NotificationModule, PushNotificationModule],
  controllers: [BrowseController],
  providers: [BrowseService],
  exports: [BrowseService],
})
export class BrowseModule {}
