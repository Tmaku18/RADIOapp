import { Module } from '@nestjs/common';
import { ProNetworkSubscriptionModule } from '../pro-network-subscription/pro-network-subscription.module';
import { UploadsModule } from '../uploads/uploads.module';
import { StudiosController } from './studios.controller';
import { StudiosService } from './studios.service';

@Module({
  imports: [ProNetworkSubscriptionModule, UploadsModule],
  controllers: [StudiosController],
  providers: [StudiosService],
  exports: [StudiosService],
})
export class StudiosModule {}
