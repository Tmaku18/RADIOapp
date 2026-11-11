import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmailModule } from '../email/email.module';
import { RadioModule } from '../radio/radio.module';
import { AppVersionModule } from '../app-version/app-version.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { PaymentsModule } from '../payments/payments.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    EmailModule,
    RadioModule,
    AppVersionModule,
    PushNotificationModule,
    PaymentsModule,
    ModerationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
