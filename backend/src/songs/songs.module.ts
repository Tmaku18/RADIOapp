import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminModule } from '../admin/admin.module';
import { CopyrightModule } from '../copyright/copyright.module';
import { LyricsModule } from '../lyrics/lyrics.module';
import { PushNotificationModule } from '../push-notifications/push-notification.module';

@Module({
  imports: [
    UploadsModule,
    AdminModule,
    CopyrightModule,
    LyricsModule,
    PushNotificationModule,
  ],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsModule {}
