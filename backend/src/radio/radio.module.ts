import { Module, forwardRef } from '@nestjs/common';
import { RadioController } from './radio.controller';
import { RadioService } from './radio.service';
import { RadioStateService } from './radio-state.service';
import { ProspectorController } from './prospector.controller';
import { ProspectorYieldService } from './prospector-yield.service';
import { PushNotificationModule } from '../push-notifications/push-notification.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    forwardRef(() => PushNotificationModule),
    forwardRef(() => ChatModule),
  ],
  controllers: [RadioController, ProspectorController],
  providers: [RadioService, RadioStateService, ProspectorYieldService],
  exports: [RadioService, RadioStateService],
})
export class RadioModule {}
