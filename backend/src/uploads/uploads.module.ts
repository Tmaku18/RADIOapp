import { Module } from '@nestjs/common';
import { ImageOptimizeService } from './image-optimize.service';
import { UploadsService } from './uploads.service';
import { DurationService } from './duration.service';
import { AudioTranscodeService } from './audio-transcode.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [ModerationModule],
  providers: [
    UploadsService,
    DurationService,
    AudioTranscodeService,
    ImageOptimizeService,
  ],
  exports: [
    UploadsService,
    DurationService,
    AudioTranscodeService,
    ModerationModule,
  ],
})
export class UploadsModule {}
