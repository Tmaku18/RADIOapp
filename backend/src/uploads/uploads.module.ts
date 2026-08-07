import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { DurationService } from './duration.service';
import { AudioTranscodeService } from './audio-transcode.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  providers: [UploadsService, DurationService, AudioTranscodeService],
  exports: [
    UploadsService,
    DurationService,
    AudioTranscodeService,
    ModerationModule,
  ],
})
export class UploadsModule {}
