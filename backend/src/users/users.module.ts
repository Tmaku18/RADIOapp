import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminModule } from '../admin/admin.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ProRadioSubscriptionModule } from '../pro-radio-subscription/pro-radio-subscription.module';

@Module({
  imports: [
    UploadsModule,
    AdminModule,
    PushNotificationModule,
    ProRadioSubscriptionModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
