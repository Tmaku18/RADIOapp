import { Module } from '@nestjs/common';
import { CreatorNetworkController } from './creator-network.controller';
import { CreatorNetworkService } from './creator-network.service';

@Module({
  controllers: [CreatorNetworkController],
  providers: [CreatorNetworkService],
  exports: [CreatorNetworkService],
})
export class CreatorNetworkModule {}
