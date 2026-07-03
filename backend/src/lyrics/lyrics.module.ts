import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElevenLabsAlignmentProvider } from './elevenlabs-alignment.provider';
import { LyricsService } from './lyrics.service';

@Module({
  imports: [ConfigModule],
  providers: [ElevenLabsAlignmentProvider, LyricsService],
  exports: [LyricsService],
})
export class LyricsModule {}
