import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('songs')
  async getSongs(
    @Query('by') by: 'likes' | 'listens' = 'likes',
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = Math.min(parseInt(limitStr || '50', 10) || 50, 100);
    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0);
    if (by === 'listens') {
      return this.leaderboardService.getSongsByListens(limit, offset);
    }
    return this.leaderboardService.getSongsByLikes(limit, offset);
  }

  @Get('upvotes-per-minute')
  async getUpvotesPerMinute(
    @Query('windowMinutes') windowMinutesStr?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const windowMinutes = Math.min(Math.max(1, parseInt(windowMinutesStr || '60', 10) || 60), 24 * 60);
    const limit = Math.min(parseInt(limitStr || '50', 10) || 50, 100);
    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0);
    return this.leaderboardService.getSongsByUpvotesPerMinute(windowMinutes, limit, offset);
  }

  @Post('songs/:id/like')
  async addLeaderboardLike(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: { playId?: string },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.leaderboardService.addLeaderboardLike(userData.id, songId, body?.playId ?? null);
  }
}
