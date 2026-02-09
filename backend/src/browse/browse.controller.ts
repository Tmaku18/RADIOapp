import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BrowseService } from './browse.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('browse')
export class BrowseController {
  constructor(private readonly browseService: BrowseService) {}

  private async getUserId(uid: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('users').select('id').eq('firebase_uid', uid).single();
    return data?.id ?? null;
  }

  @Get('feed')
  @UseGuards(FirebaseAuthGuard)
  async getFeed(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
    @Query('seed') seed?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 12, 30) : undefined;
    const userId = await this.getUserId(user.uid);
    return this.browseService.getFeed(limit, cursor, seed, userId ?? undefined);
  }

  @Post('feed/:contentId/like')
  @UseGuards(FirebaseAuthGuard)
  async toggleLike(@CurrentUser() user: FirebaseUser, @Param('contentId') contentId: string) {
    const userId = await this.getUserId(user.uid);
    if (!userId) throw new BadRequestException('User not found');
    return this.browseService.toggleLike(userId, contentId);
  }

  @Post('feed/:contentId/bookmark')
  @UseGuards(FirebaseAuthGuard)
  async addBookmark(@CurrentUser() user: FirebaseUser, @Param('contentId') contentId: string) {
    const userId = await this.getUserId(user.uid);
    if (!userId) throw new BadRequestException('User not found');
    await this.browseService.addBookmark(userId, contentId);
    return { bookmarked: true };
  }

  @Delete('feed/:contentId/bookmark')
  @UseGuards(FirebaseAuthGuard)
  async removeBookmark(@CurrentUser() user: FirebaseUser, @Param('contentId') contentId: string) {
    const userId = await this.getUserId(user.uid);
    if (!userId) throw new BadRequestException('User not found');
    await this.browseService.removeBookmark(userId, contentId);
    return { bookmarked: false };
  }

  @Post('feed/:contentId/report')
  @UseGuards(FirebaseAuthGuard)
  async reportContent(
    @CurrentUser() user: FirebaseUser,
    @Param('contentId') contentId: string,
    @Body() body: { reason: string },
  ) {
    const userId = await this.getUserId(user.uid);
    if (!userId) throw new BadRequestException('User not found');
    const reason = body?.reason?.trim();
    if (!reason || reason.length < 1) throw new BadRequestException('Report reason is required');
    await this.browseService.reportContent(userId, contentId, reason);
    return { reported: true };
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('limitPerCategory') limitStr?: string) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 5, 20) : 5;
    return this.browseService.getLeaderboardByCategory(limit);
  }

  @Get('bookmarks')
  @UseGuards(FirebaseAuthGuard)
  async getBookmarks(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limitStr?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    if (!userId) throw new BadRequestException('User not found');
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 100) : 50;
    return this.browseService.getBookmarks(userId, limit);
  }
}
