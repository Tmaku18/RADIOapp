import { Module } from '@nestjs/common';
import { DjBoothController } from './dj-booth.controller';
import { DjBoothService } from './dj-booth.service';
import { RadioModule } from '../radio/radio.module';
import { StreamingModule } from '../streaming/streaming.module';

@Module({
  imports: [RadioModule, StreamingModule],
  controllers: [DjBoothController],
  providers: [DjBoothService],
  exports: [DjBoothService],
})
export class DjBoothModule {}
