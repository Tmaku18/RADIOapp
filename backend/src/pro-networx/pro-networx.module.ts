import { Module } from '@nestjs/common';
import { ProNetworxController } from './pro-networx.controller';
import { ProNetworxService } from './pro-networx.service';

@Module({
  controllers: [ProNetworxController],
  providers: [ProNetworxService],
})
export class ProNetworxModule {}

