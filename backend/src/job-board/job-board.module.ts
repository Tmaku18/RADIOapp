import { Module } from '@nestjs/common';
import { JobBoardController } from './job-board.controller';
import { JobBoardService } from './job-board.service';
import { NotificationModule } from '../notifications/notification.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';

@Module({
  imports: [
    NotificationModule,
    PushNotificationModule,
    ProNetworkSubscriptionModule,
  ],
  controllers: [JobBoardController],
  providers: [JobBoardService],
  exports: [JobBoardService],
})
export class JobBoardModule {}
