import { Module } from '@nestjs/common';
import { ImageModerationService } from './image-moderation.service';

@Module({
  providers: [ImageModerationService],
  exports: [ImageModerationService],
})
export class ModerationModule {}
