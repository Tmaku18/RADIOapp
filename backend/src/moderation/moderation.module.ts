import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { ImageModerationService } from './image-moderation.service';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [ChatModule],
  controllers: [ModerationController],
  providers: [ImageModerationService, ModerationService],
  exports: [ImageModerationService, ModerationService],
})
export class ModerationModule {}
