import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { SpotlightService } from './spotlight.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('spotlight')
export class SpotlightController {
  constructor(private readonly spotlightService: SpotlightService) {}

  @Get('today')
  async getToday() {
    return this.spotlightService.getToday();
  }

  @Get('week')
  async getWeek(@Query('start') start?: string) {
    const startDate = start || new Date().toISOString().slice(0, 10);
    return this.spotlightService.getWeek(startDate);
  }

  @Get('can-listen-unlimited')
  async canListenUnlimited(
    @Query('artistId') artistId: string,
    @Query('songId') songId: string,
  ) {
    if (!artistId || !songId) return { allowed: false };
    return this.spotlightService.canListenUnlimited(artistId, songId);
  }

  @Post('listen')
  async recordListen(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { songId: string; artistId: string; context: 'featured_replay' | 'artist_of_week' | 'artist_of_month' },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', user.uid).single();
    if (!userData) throw new Error('User not found');
    if (!body?.songId || !body?.artistId || !body?.context) throw new Error('songId, artistId, and context required');
    const allowed = await this.spotlightService.canListenUnlimited(body.artistId, body.songId);
    if (!allowed.allowed) throw new Error('Unlimited listening not allowed for this song/artist');
    await this.spotlightService.recordListen(userData.id, body.songId, body.artistId, body.context);
    return { ok: true };
  }
}
