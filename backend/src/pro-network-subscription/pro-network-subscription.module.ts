import { Module } from '@nestjs/common';
import { ProNetworkSubscriptionController } from './pro-network-subscription.controller';
import { ProNetworkSubscriptionService } from './pro-network-subscription.service';

@Module({
  controllers: [ProNetworkSubscriptionController],
  providers: [ProNetworkSubscriptionService],
  exports: [ProNetworkSubscriptionService],
})
export class ProNetworkSubscriptionModule {}
