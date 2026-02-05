import { Controller, Get, Query } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  /**
   * GET /api/suggestions/local-artists
   * Returns artists in the current user's region (for "Have you heard this artist in your area?").
   * User's region must be set in profile; if suggestLocalArtists is false, frontend may skip calling this.
   */
  @Get('local-artists')
  async getLocalArtists(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: me } = await supabase
      .from('users')
      .select('region, suggest_local_artists')
      .eq('firebase_uid', user.uid)
      .single();

    if (!me?.suggest_local_artists) {
      return { artists: [] };
    }
    const limitNum = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 20);
    const artists = await this.suggestionsService.getLocalArtists(me.region ?? null, limitNum);
    return { artists };
  }
}
