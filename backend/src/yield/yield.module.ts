import { Module } from '@nestjs/common';
import { YieldController } from './yield.controller';
import { RadioModule } from '../radio/radio.module';

@Module({
  imports: [RadioModule],
  controllers: [YieldController],
})
export class YieldModule {}

