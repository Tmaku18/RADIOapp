import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get current user's artist analytics.
   * Artists can view their own stats.
   */
  @Get('me')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getMyAnalytics(
    @CurrentUser() user: FirebaseUser,
    @Query('days') days?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    const daysNum = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getArtistAnalytics(userData.id, daysNum);
  }

  /**
   * Get analytics for a specific song.
   * Only the song owner or admin can view.
   */
  @Get('songs/:id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getSongAnalytics(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Query('days') days?: string,
  ) {
    const supabase = getSupabaseClient();
    
    // Check ownership (unless admin)
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    const { data: song } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', songId)
      .single();

    if (!song) {
      throw new Error('Song not found');
    }

    if (userData.role !== 'admin' && song.artist_id !== userData.id) {
      throw new Error('You can only view analytics for your own songs');
    }

    const daysNum = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getSongAnalytics(songId, daysNum);
  }

  /**
   * Get platform-wide statistics.
   * Public endpoint for marketing page.
   */
  @Get('platform')
  @Public()
  async getPlatformStats() {
    return this.analyticsService.getPlatformStats();
  }
}
