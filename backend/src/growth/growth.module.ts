import { Module } from '@nestjs/common';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

@Module({
  imports: [PushNotificationModule],
  controllers: [GrowthController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
