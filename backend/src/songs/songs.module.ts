import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminModule } from '../admin/admin.module';
import { CopyrightModule } from '../copyright/copyright.module';
import { LyricsModule } from '../lyrics/lyrics.module';

@Module({
  imports: [UploadsModule, AdminModule, CopyrightModule, LyricsModule],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsModule {}
