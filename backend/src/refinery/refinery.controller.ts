import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { RefineryService } from './refinery.service';
import { SubmitRefineryDto } from './dto/submit-refinery.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

/**
 * The Refinery: paid in-depth song reviews.
 * - Artists submit songs ($4.99) with up to 10 custom questions.
 * - Users sign up as Reviewers (auto-accepted) to answer surveys + earn rewards.
 * - Artists view real-time analytics on their songs in The Refinery.
 */
@Controller('refinery')
@UseGuards(FirebaseAuthGuard)
export class RefineryController {
  constructor(private readonly refineryService: RefineryService) {}

  // ---------------------------------------------------------------------------
  // Standard questions (public to any authenticated user)
  // ---------------------------------------------------------------------------
  @Get('standard-questions')
  getStandardQuestions() {
    return this.refineryService.getStandardQuestions();
  }

  // ---------------------------------------------------------------------------
  // Reviewer signup / status (any authenticated user can become a reviewer)
  // ---------------------------------------------------------------------------
  @Post('reviewer/signup')
  @HttpCode(200)
  async signUpReviewer(@CurrentUser() user: FirebaseUser) {
    return this.refineryService.signUpReviewer(user.uid);
  }

  @Get('reviewer/status')
  async reviewerStatus(@CurrentUser() user: FirebaseUser) {
    return this.refineryService.getReviewerStatus(user.uid);
  }

  // ---------------------------------------------------------------------------
  // Artist submission ($4.99 Stripe Checkout)
  // ---------------------------------------------------------------------------
  @Post('songs/:id/submit')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async submitSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: SubmitRefineryDto,
  ) {
    return this.refineryService.createSubmissionCheckoutSession(
      user.uid,
      songId,
      body.customQuestions ?? [],
    );
  }

  /**
   * Artist withdraws their song from The Refinery (no refund).
   * Useful if the song needs to be edited or unpublished.
   */
  @Post('songs/:id/remove')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async removeSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    return this.refineryService.removeFromRefinery(user.uid, songId);
  }

  // ---------------------------------------------------------------------------
  // Reviewer queue
  // ---------------------------------------------------------------------------
  @Get('songs')
  async listQueue(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(parseInt(limit ?? '50', 10) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.refineryService.listReviewQueue(user.uid, limitNum, offsetNum);
  }

  @Get('songs/:id/review-form')
  async getReviewForm(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    return this.refineryService.getReviewForm(user.uid, songId);
  }

  @Post('songs/:id/review')
  async submitReview(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: SubmitReviewDto,
  ) {
    return this.refineryService.submitReview(user.uid, songId, body);
  }

  // ---------------------------------------------------------------------------
  // Analytics (artist-only, owner of song)
  // ---------------------------------------------------------------------------
  @Get('songs/:id/analytics')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getAnalytics(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.refineryService.getAnalytics(
      user.uid,
      songId,
      limitNum,
      offsetNum,
    );
  }

  /** Artist favorites / unfavorites a review on their song. */
  @Post('songs/:id/reviews/:reviewId/favorite')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async favoriteReview(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Param('reviewId') reviewId: string,
    @Body() body: { favorited?: boolean },
  ) {
    return this.refineryService.setReviewFavorite(
      user.uid,
      songId,
      reviewId,
      body?.favorited === true,
    );
  }

  /** Artist rates the quality of the feedback (1-5, or null to clear). */
  @Post('songs/:id/reviews/:reviewId/quality')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async rateReviewQuality(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Param('reviewId') reviewId: string,
    @Body() body: { rating?: number | null },
  ) {
    const rating =
      body?.rating === null || body?.rating === undefined
        ? null
        : Number(body.rating);
    return this.refineryService.setReviewQuality(
      user.uid,
      songId,
      reviewId,
      rating,
    );
  }

  // ---------------------------------------------------------------------------
  // Comments (legacy free-text comment surface)
  // ---------------------------------------------------------------------------
  @Get('songs/:id/comments')
  async getComments(
    @Param('id') songId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = Math.min(parseInt(limit ?? '50', 10) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset ?? '0', 10) || 0);
    return this.refineryService.getComments(songId, limitNum, offsetNum);
  }

  @Post('songs/:id/comments')
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
    return this.refineryService.addComment(
      songId,
      userData.id,
      body?.body ?? '',
    );
  }
}
