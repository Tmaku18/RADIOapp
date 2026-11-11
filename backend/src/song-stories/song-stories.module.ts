import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { SongStoriesController } from './song-stories.controller';
import { SongStoriesService } from './song-stories.service';

@Module({
  imports: [UploadsModule, UsersModule],
  controllers: [SongStoriesController],
  providers: [SongStoriesService],
  exports: [SongStoriesService],
})
export class SongStoriesModule {}
