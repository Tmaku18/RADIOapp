import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { ProRadioSubscriptionModule } from '../pro-radio-subscription/pro-radio-subscription.module';

@Module({
  imports: [ProRadioSubscriptionModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
