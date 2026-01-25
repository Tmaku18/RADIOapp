import { Module, forwardRef } from '@nestjs/common';
import { RadioController } from './radio.controller';
import { RadioService } from './radio.service';
import { RadioStateService } from './radio-state.service';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    forwardRef(() => PushNotificationModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [RadioController],
  providers: [RadioService, RadioStateService],
  exports: [RadioService, RadioStateService],
})
export class RadioModule {}
