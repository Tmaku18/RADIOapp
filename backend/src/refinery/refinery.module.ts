import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RefineryController } from './refinery.controller';
import { RefineryService } from './refinery.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [ConfigModule, forwardRef(() => PaymentsModule), NotificationModule],
  controllers: [RefineryController],
  providers: [RefineryService],
  exports: [RefineryService],
})
export class RefineryModule {}
