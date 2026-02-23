import { Module } from '@nestjs/common';
import { RefineryController } from './refinery.controller';
import { RefineryService } from './refinery.service';

@Module({
  controllers: [RefineryController],
  providers: [RefineryService],
  exports: [RefineryService],
})
export class RefineryModule {}
