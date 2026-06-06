import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UploadsModule } from '../uploads/uploads.module';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';

@Module({
  imports: [UploadsModule, ProNetworkSubscriptionModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
