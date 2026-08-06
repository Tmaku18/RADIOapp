import { Module } from '@nestjs/common';
import { ProRadioSubscriptionController } from './pro-radio-subscription.controller';
import { ProRadioSubscriptionService } from './pro-radio-subscription.service';

@Module({
  controllers: [ProRadioSubscriptionController],
  providers: [ProRadioSubscriptionService],
  exports: [ProRadioSubscriptionService],
})
export class ProRadioSubscriptionModule {}
