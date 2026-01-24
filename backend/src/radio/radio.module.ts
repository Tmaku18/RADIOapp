import { Module, forwardRef } from '@nestjs/common';
import { RadioController } from './radio.controller';
import { RadioService } from './radio.service';
import { PushNotificationModule } from '../push-notifications/push-notification.module';

@Module({
  imports: [forwardRef(() => PushNotificationModule)],
  controllers: [RadioController],
  providers: [RadioService],
  exports: [RadioService],
})
export class RadioModule {}
