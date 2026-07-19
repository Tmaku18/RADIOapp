import { Module, forwardRef } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { RadioModule } from '../radio/radio.module';

@Module({
  imports: [forwardRef(() => RadioModule)],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
