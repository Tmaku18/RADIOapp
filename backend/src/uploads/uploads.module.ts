import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { DurationService } from './duration.service';

@Module({
  providers: [UploadsService, DurationService],
  exports: [UploadsService, DurationService],
})
export class UploadsModule {}
