import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
   * ROI = (New Followers / Credits Spent) * 100 over a window.
   */
  @Get('me/roi')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getMyRoi(
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
    return this.analyticsService.getRoiForArtist(userData.id, daysNum);
  }

  /**
   * "Heatmap" proxy: counts of engaged listeners by region in the window.
   * Uses profile clicks joined to user region (plays currently have no geo).
   */
  @Get('me/plays-by-region')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getMyPlaysByRegion(
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
    return this.analyticsService.getPlaysByRegionForArtist(userData.id, daysNum);
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
   * Get a single play's analytics (time played, listeners, likes/comments/profile clicks during play).
   * Used when the artist taps "Your song has been played" notification to view that play's stats.
   * Only the song's artist can view.
   */
  @Get('plays/:playId')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getPlayAnalytics(
    @CurrentUser() user: FirebaseUser,
    @Param('playId') playId: string,
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

    // Resolve play -> song -> artist so admin can view any play
    const { data: playRow } = await supabase
      .from('plays')
      .select('song_id')
      .eq('id', playId)
      .single();
    if (!playRow) {
      throw new Error('Play not found');
    }
    const { data: songRow } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', playRow.song_id)
      .single();
    if (!songRow) {
      throw new Error('Song not found');
    }
    const { data: roleData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userData.id)
      .single();
    const isAdmin = roleData?.role === 'admin';
    if (!isAdmin && songRow.artist_id !== userData.id) {
      throw new Error('Access denied');
    }
    const result = await this.analyticsService.getPlayById(playId, songRow.artist_id);
    if (!result) {
      throw new Error('Play not found');
    }
    return result;
  }

  /**
   * Record that the current user clicked the artist's profile from the player (for per-play analytics).
   */
  @Post('profile-click')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'admin')
  async recordProfileClick(
    @CurrentUser() user: FirebaseUser,
    @Body('songId') songId: string,
  ) {
    if (!songId) {
      throw new Error('songId is required');
    }
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
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
    await supabase.from('profile_clicks').insert({
      user_id: userData.id,
      artist_id: song.artist_id,
      song_id: songId,
    });
    return { success: true };
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
