import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('competition')
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get('current-week')
  getCurrentWeek() {
    return this.competitionService.getCurrentWeek();
  }

  @Post('vote')
  async vote(@CurrentUser() user: FirebaseUser, @Body() body: { songIds: string[] }) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', user.uid).single();
    if (!userData) throw new Error('User not found');
    return this.competitionService.submitVote(userData.id, body?.songIds ?? []);
  }

  @Get('weekly-results')
  async getWeeklyResults(@Query('period') period?: string) {
    const periodStart = period || this.competitionService.getCurrentWeek().periodStart;
    return this.competitionService.getWeeklyResults(periodStart);
  }

  @Get('monthly-winners')
  async getMonthlyWinners(
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    return this.competitionService.getMonthlyWinners(year, month);
  }

  @Get('yearly-winners')
  async getYearlyWinners(@Query('year') yearStr?: string) {
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    return this.competitionService.getYearlyWinners(year);
  }
}
