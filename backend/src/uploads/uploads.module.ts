import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { DurationService } from './duration.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  providers: [UploadsService, DurationService],
  exports: [UploadsService, DurationService, ModerationModule],
})
export class UploadsModule {}
