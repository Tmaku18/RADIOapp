import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { RefineryService } from './refinery.service';

/**
 * The Refinery: portal where artists submit songs for review.
 * Prospectors (listeners) can hear songs unlimited, answer surveys, rank, and comment for rewards.
 * Regular listeners do not have access (enforced by role: only listener/artist/admin).
 */
@Controller('refinery')
@UseGuards(FirebaseAuthGuard)
export class RefineryController {
  constructor(private readonly refineryService: RefineryService) {}

  /**
   * List songs in The Refinery. Prospector-only (listener role).
   */
  @Get('songs')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'admin')
  async listSongs(
    @CurrentUser() _user: FirebaseUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(parseInt(limit ?? '100', 10) || 100, 200);
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.refineryService.listRefinerySongs(limitNum, offsetNum);
  }

  /**
   * Artist adds own song to The Refinery.
   */
  @Post('songs/:id/add')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async addSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.refineryService.addSongToRefinery(songId, userData.id);
  }

  /**
   * Artist removes own song from The Refinery.
   */
  @Post('songs/:id/remove')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async removeSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.refineryService.removeSongFromRefinery(songId, userData.id);
  }

  /**
   * Get comments for a refinery song. Prospector/listener.
   */
  @Get('songs/:id/comments')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'admin')
  async getComments(
    @Param('id') songId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(parseInt(limit ?? '50', 10) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.refineryService.getComments(songId, limitNum, offsetNum);
  }

  /**
   * Prospector (listener) posts a comment on a refinery song.
   */
  @Post('songs/:id/comments')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'admin')
  async addComment(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: { body?: string },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.refineryService.addComment(songId, userData.id, body?.body ?? '');
  }
}
