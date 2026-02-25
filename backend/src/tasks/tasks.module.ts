import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupService } from './cleanup.service';
import { CompetitionCronService } from './competition-cron.service';
import { DailyDiamondCronService } from './daily-diamond-cron.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CleanupService, CompetitionCronService, DailyDiamondCronService],
})
export class TasksModule {}
