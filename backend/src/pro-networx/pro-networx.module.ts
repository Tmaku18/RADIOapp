import { Module } from '@nestjs/common';
import { ProNetworxController } from './pro-networx.controller';
import { ProNetworxService } from './pro-networx.service';
import { ProResumeController } from './pro-resume.controller';
import {
  ProServicesController,
  ProMyServicesController,
  ProUserServicesController,
} from './pro-services.controller';
import { ProServicesService } from './pro-services.service';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [ProNetworkSubscriptionModule, UploadsModule],
  controllers: [
    ProNetworxController,
    ProResumeController,
    ProServicesController,
    ProMyServicesController,
    ProUserServicesController,
  ],
  providers: [ProNetworxService, ProServicesService],
  exports: [ProNetworxService, ProServicesService],
})
export class ProNetworxModule {}
