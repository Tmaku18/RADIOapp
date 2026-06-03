import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { signSongAudioUrl } from '../common/song-audio.util';
import { StripeService } from '../payments/stripe.service';
import { NotificationService } from '../notifications/notification.service';
import {
  REFINERY_DEFAULT_MIN_REVIEWS,
  REFINERY_MAX_CUSTOM_QUESTIONS,
  REFINERY_RATING_KEYS,
  REFINERY_RATING_QUESTIONS,
  REFINERY_REVIEW_REWARD_CENTS,
  REFINERY_SUBMISSION_ORIGINAL_PRICE_CENTS,
  REFINERY_SUBMISSION_PRICE_CENTS,
  REFINERY_SURVEY_KEYS,
  REFINERY_SURVEY_QUESTIONS,
  RatingKey,
} from './refinery-questions';
import { SubmitReviewDto } from './dto/submit-review.dto';

export interface ReviewQueueRow {
  songId: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  audioUrl: string;
  durationSeconds: number | null;
  reviewCount: number;
  likeCount: number;
  hasCustomQuestions: boolean;
  submittedAt: string | null;
}

export interface RatingStats {
  count: number;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  min: number | null;
  max: number | null;
}

@Injectable()
export class RefineryService {
  private readonly logger = new Logger(RefineryService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getUserIdFromFirebase(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) {
      throw new NotFoundException('User profile not found');
    }
    return data.id;
  }

  // ---------------------------------------------------------------------------
  // Standard questions
  // ---------------------------------------------------------------------------

  getStandardQuestions() {
    return {
      ratingQuestions: REFINERY_RATING_QUESTIONS,
      surveyQuestions: REFINERY_SURVEY_QUESTIONS,
      submissionPriceCents: REFINERY_SUBMISSION_PRICE_CENTS,
      submissionOriginalPriceCents: REFINERY_SUBMISSION_ORIGINAL_PRICE_CENTS,
      reviewRewardCents: REFINERY_REVIEW_REWARD_CENTS,
      defaultMinReviews: REFINERY_DEFAULT_MIN_REVIEWS,
      maxCustomQuestions: REFINERY_MAX_CUSTOM_QUESTIONS,
    };
  }

  // ---------------------------------------------------------------------------
  // Reviewer signup / status
  // ---------------------------------------------------------------------------

  async signUpReviewer(firebaseUid: string) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('reviewers')
      .upsert(
        {
          user_id: userId,
          is_active: true,
        },
        { onConflict: 'user_id', ignoreDuplicates: false },
      )
      .select('user_id, signed_up_at, total_reviews, is_active')
      .single();

    if (error) {
      this.logger.warn(`signUpReviewer failed: ${error.message}`);
      throw new BadRequestException('Failed to sign up as reviewer');
    }

    return {
      isReviewer: true,
      signedUpAt: data?.signed_up_at,
      totalReviews: data?.total_reviews ?? 0,
    };
  }

  async getReviewerStatus(firebaseUid: string) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('reviewers')
      .select('user_id, signed_up_at, total_reviews, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    return {
      isReviewer: Boolean(data && data.is_active),
      signedUpAt: data?.signed_up_at ?? null,
      totalReviews: data?.total_reviews ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Artist submission ($4.99 Stripe Checkout)
  // ---------------------------------------------------------------------------

  async createSubmissionCheckoutSession(
    firebaseUid: string,
    songId: string,
    customQuestions: string[],
  ) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();

    const { data: song, error } = await supabase
      .from('songs')
      .select('id, artist_id, title, in_refinery')
      .eq('id', songId)
      .single();

    if (error || !song) throw new NotFoundException('Song not found');
    if (song.artist_id !== userId) {
      throw new ForbiddenException('You can only submit your own songs');
    }
    if (song.in_refinery) {
      throw new BadRequestException('Song is already in The Refinery');
    }

    const trimmed = (customQuestions ?? [])
      .map((q) => (q ?? '').trim())
      .filter((q) => q.length > 0)
      .slice(0, REFINERY_MAX_CUSTOM_QUESTIONS);

    // Persist custom questions up-front so the webhook doesn't need to ferry
    // arbitrary-length data through Stripe metadata. They sit attached to the
    // song but only become "live" once we flip in_refinery in fulfillSubmission.
    await supabase.from('refinery_custom_questions').delete().eq('song_id', songId);
    if (trimmed.length > 0) {
      const rows = trimmed.map((q, i) => ({
        song_id: songId,
        question_text: q,
        display_order: i,
      }));
      const { error: cqErr } = await supabase
        .from('refinery_custom_questions')
        .insert(rows);
      if (cqErr) {
        this.logger.warn(
          `Failed to insert custom questions for ${songId}: ${cqErr.message}`,
        );
      }
    }

    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: REFINERY_SUBMISSION_PRICE_CENTS,
        credits_purchased: 0,
        status: 'pending',
        payment_method: 'checkout_session',
        purpose: 'refinery_submission',
        song_id: songId,
      })
      .select()
      .single();

    if (txError || !tx) {
      throw new BadRequestException(
        `Failed to create transaction: ${txError?.message ?? 'unknown error'}`,
      );
    }

    const webUrl =
      this.config.get<string>('WEB_URL') || 'http://localhost:3001';
    const successUrl = `${webUrl}/refinery/analytics/${songId}?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${webUrl}/artist/songs?refinery_canceled=true`;

    const session = await this.stripe.createCheckoutSessionSongPlays(
      REFINERY_SUBMISSION_PRICE_CENTS,
      `Refinery review – ${song.title}`,
      'In-depth review by 100 verified Networx reviewers',
      {
        userId,
        transactionId: tx.id,
        songId,
        purpose: 'refinery_submission',
      },
      successUrl,
      cancelUrl,
    );

    await supabase
      .from('transactions')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', tx.id);

    return {
      sessionId: session.id,
      url: session.url,
      transactionId: tx.id,
    };
  }

  /**
   * Webhook fulfillment: called by PaymentsService when a refinery_submission
   * Stripe Checkout session completes. Flips the song into in_refinery and
   * sends a confirmation notification. Custom questions are saved up-front
   * during checkout creation, so we don't need to parse Stripe metadata here.
   */
  async fulfillSubmission(params: { songId: string; artistUserId: string }) {
    const supabase = getSupabaseClient();
    const { songId, artistUserId } = params;

    const { data: song } = await supabase
      .from('songs')
      .select('id, in_refinery, title, artist_id')
      .eq('id', songId)
      .single();
    if (!song) {
      this.logger.warn(`fulfillSubmission: song ${songId} not found`);
      return;
    }
    if (song.in_refinery) {
      this.logger.log(
        `fulfillSubmission: song ${songId} already in refinery; skipping`,
      );
      return;
    }

    await supabase
      .from('songs')
      .update({
        in_refinery: true,
        refinery_submitted_at: new Date().toISOString(),
        refinery_review_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId);

    try {
      await this.notifications.create({
        userId: artistUserId,
        type: 'refinery_submission_received',
        title: 'Your song is in The Refinery',
        message: `"${song.title}" is now under review. You'll be notified as reviews come in.`,
        metadata: { songId },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create submission notification: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Artist withdraws their song from The Refinery (no refund). */
  async removeFromRefinery(firebaseUid: string, songId: string) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, artist_id, in_refinery')
      .eq('id', songId)
      .single();
    if (!song) throw new NotFoundException('Song not found');
    if (song.artist_id !== userId) {
      throw new ForbiddenException('You can only withdraw your own songs');
    }
    const { error } = await supabase
      .from('songs')
      .update({ in_refinery: false, updated_at: new Date().toISOString() })
      .eq('id', songId);
    if (error) {
      throw new BadRequestException('Failed to remove song from Refinery');
    }
    return { removed: true, songId };
  }

  // ---------------------------------------------------------------------------
  // Reviewer queue (shuffled, weighted, exclude already-reviewed)
  // ---------------------------------------------------------------------------

  async listReviewQueue(
    firebaseUid: string,
    limit = 50,
    offset = 0,
  ): Promise<{ songs: ReviewQueueRow[]; limit: number; offset: number }> {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();

    const { data: reviewed } = await supabase
      .from('refinery_reviews')
      .select('song_id')
      .eq('reviewer_id', userId);
    const reviewedIds = new Set<string>(
      (reviewed ?? []).map((r: { song_id: string }) => r.song_id),
    );

    let query = supabase
      .from('songs')
      .select(
        'id, title, artist_id, artist_name, artwork_url, audio_url, duration_seconds, like_count, refinery_review_count, refinery_submitted_at, refinery_min_reviews',
      )
      .eq('in_refinery', true);

    if (reviewedIds.size > 0) {
      const ids = Array.from(reviewedIds).join(',');
      query = query.not('id', 'in', `(${ids})`);
    }

    const { data: rows, error } = await query.limit(500);
    if (error) {
      this.logger.warn(`listReviewQueue error: ${error.message}`);
      throw new BadRequestException('Failed to load review queue');
    }

    const songIds = (rows ?? []).map((r: { id: string }) => r.id);
    const customMap = new Map<string, boolean>();
    const realLikesBySongId = new Map<string, number>();
    if (songIds.length > 0) {
      const { data: customQs } = await supabase
        .from('refinery_custom_questions')
        .select('song_id')
        .in('song_id', songIds);
      for (const q of customQs ?? []) {
        customMap.set((q as { song_id: string }).song_id, true);
      }
      // Real likes count from the global `likes` table.
      const { data: statsRows } = await supabase.rpc(
        'get_artist_song_stats',
        { p_song_ids: songIds },
      );
      for (const row of (statsRows ?? []) as Array<{
        song_id: string;
        like_count: number | string | null;
      }>) {
        if (!row.song_id) continue;
        realLikesBySongId.set(row.song_id, Number(row.like_count) || 0);
      }
    }

    type SongRow = {
      id: string;
      title: string;
      artist_id: string;
      artist_name: string;
      artwork_url: string | null;
      audio_url: string;
      duration_seconds: number | null;
      like_count: number | null;
      refinery_review_count: number | null;
      refinery_submitted_at: string | null;
      refinery_min_reviews: number | null;
    };
    const enriched = (rows ?? []).map((r: SongRow) => {
      const reviewCount = r.refinery_review_count ?? 0;
      // Weight = 1 / (1 + reviewCount). Songs with fewer reviews are more
      // likely to surface near the top. Older submissions get a small tiebreaker
      // so the very first songs aren't starved over time.
      const ageBonusMs = r.refinery_submitted_at
        ? Date.now() - new Date(r.refinery_submitted_at).getTime()
        : 0;
      const ageBonus = Math.min(ageBonusMs / (1000 * 60 * 60 * 24 * 7), 1); // up to +1 after a week
      const baseWeight = 1 / (1 + reviewCount);
      const weight = baseWeight * (1 + ageBonus);
      const noisyKey = -Math.log(1 - Math.random()) / weight;
      return { row: r, noisyKey };
    });
    enriched.sort((a, b) => a.noisyKey - b.noisyKey);

    const paged = enriched.slice(offset, offset + limit);

    const result: ReviewQueueRow[] = await Promise.all(
      paged.map(async ({ row }) => ({
        songId: row.id,
        title: row.title,
        artistName: row.artist_name,
        artistId: row.artist_id,
        artworkUrl: row.artwork_url,
        // Reviewers listen to the full track; sign it from the private bucket.
        audioUrl: (await signSongAudioUrl(row.audio_url)) ?? row.audio_url,
        durationSeconds: row.duration_seconds,
        reviewCount: row.refinery_review_count ?? 0,
        likeCount: realLikesBySongId.get(row.id) ?? row.like_count ?? 0,
        hasCustomQuestions: customMap.has(row.id),
        submittedAt: row.refinery_submitted_at,
      })),
    );

    return { songs: result, limit, offset };
  }

  // ---------------------------------------------------------------------------
  // Review form (song + custom questions for a single song)
  // ---------------------------------------------------------------------------

  async getReviewForm(firebaseUid: string, songId: string) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('refinery_reviews')
      .select('id')
      .eq('reviewer_id', userId)
      .eq('song_id', songId)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException('You have already reviewed this song');
    }

    const { data: song, error } = await supabase
      .from('songs')
      .select(
        'id, title, artist_id, artist_name, artwork_url, audio_url, duration_seconds, in_refinery, like_count',
      )
      .eq('id', songId)
      .single();
    if (error || !song) throw new NotFoundException('Song not found');
    if (!song.in_refinery) {
      throw new BadRequestException('Song is not in The Refinery');
    }

    const { data: customQs } = await supabase
      .from('refinery_custom_questions')
      .select('id, question_text, display_order')
      .eq('song_id', songId)
      .order('display_order', { ascending: true });

    return {
      song: {
        id: song.id,
        title: song.title,
        artistId: song.artist_id,
        artistName: song.artist_name,
        artworkUrl: song.artwork_url,
        audioUrl: (await signSongAudioUrl(song.audio_url)) ?? song.audio_url,
        durationSeconds: song.duration_seconds,
        likeCount: song.like_count ?? 0,
      },
      ratingQuestions: REFINERY_RATING_QUESTIONS,
      surveyQuestions: REFINERY_SURVEY_QUESTIONS,
      customQuestions: (customQs ?? []).map((q: { id: string; question_text: string; display_order: number }) => ({
        id: q.id,
        questionText: q.question_text,
        displayOrder: q.display_order,
      })),
      reviewRewardCents: REFINERY_REVIEW_REWARD_CENTS,
    };
  }

  // ---------------------------------------------------------------------------
  // Submit review
  // ---------------------------------------------------------------------------

  async submitReview(firebaseUid: string, songId: string, dto: SubmitReviewDto) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();

    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, artist_id, title, in_refinery')
      .eq('id', songId)
      .single();
    if (songErr || !song) throw new NotFoundException('Song not found');
    if (!song.in_refinery) {
      throw new BadRequestException('Song is not in The Refinery');
    }

    const allowedSurveyKeys = new Set(REFINERY_SURVEY_KEYS);
    const surveyResponses: Record<string, string> = {};
    for (const [key, value] of Object.entries(dto.surveyResponses ?? {})) {
      if (allowedSurveyKeys.has(key) && typeof value === 'string') {
        surveyResponses[key] = value.slice(0, 64);
      }
    }
    for (const key of REFINERY_SURVEY_KEYS) {
      if (!(key in surveyResponses)) {
        throw new BadRequestException(`Missing survey response: ${key}`);
      }
    }

    const customResponses: Record<string, string> = {};
    if (dto.customResponses) {
      const { data: customQs } = await supabase
        .from('refinery_custom_questions')
        .select('id')
        .eq('song_id', songId);
      const allowedCustomIds = new Set(
        (customQs ?? []).map((q: { id: string }) => q.id),
      );
      for (const [key, value] of Object.entries(dto.customResponses)) {
        if (allowedCustomIds.has(key) && typeof value === 'string') {
          customResponses[key] = value.slice(0, 1000);
        }
      }
    }

    const insertPayload = {
      song_id: songId,
      reviewer_id: userId,
      overall_rating: dto.overallRating,
      beat_rating: dto.beatRating,
      lyrics_rating: dto.lyricsRating,
      chorus_rating: dto.chorusRating,
      opening_ending_rating: dto.openingEndingRating,
      survey_responses: surveyResponses,
      custom_responses: customResponses,
      comment: dto.comment ?? null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('refinery_reviews')
      .insert(insertPayload)
      .select('id, created_at')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        throw new BadRequestException('You have already reviewed this song');
      }
      this.logger.warn(`submitReview insert error: ${insErr.message}`);
      throw new BadRequestException('Failed to submit review');
    }

    // Credit reviewer's yield balance ($0.02 per review).
    try {
      const { data: yieldRow } = await supabase
        .from('prospector_yield')
        .select('balance_cents, total_earned_cents')
        .eq('user_id', userId)
        .maybeSingle();
      if (yieldRow) {
        await supabase
          .from('prospector_yield')
          .update({
            balance_cents: (yieldRow.balance_cents ?? 0) + REFINERY_REVIEW_REWARD_CENTS,
            total_earned_cents:
              (yieldRow.total_earned_cents ?? 0) + REFINERY_REVIEW_REWARD_CENTS,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      } else {
        await supabase.from('prospector_yield').insert({
          user_id: userId,
          balance_cents: REFINERY_REVIEW_REWARD_CENTS,
          total_earned_cents: REFINERY_REVIEW_REWARD_CENTS,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to credit yield for reviewer ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Notify artist
    try {
      await this.notifications.create({
        userId: song.artist_id,
        type: 'refinery_new_review',
        title: 'New Refinery review',
        message: `Someone just reviewed "${song.title}".`,
        metadata: { songId, reviewId: inserted?.id },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify artist of new review: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      reviewId: inserted?.id,
      createdAt: inserted?.created_at,
      rewardCents: REFINERY_REVIEW_REWARD_CENTS,
    };
  }

  // ---------------------------------------------------------------------------
  // Analytics (artist-only)
  // ---------------------------------------------------------------------------

  private summarizeRatings(values: number[]): RatingStats {
    const filtered = values.filter((v) => Number.isFinite(v));
    const count = filtered.length;
    if (count === 0) {
      return { count: 0, mean: null, median: null, stddev: null, min: null, max: null };
    }
    const sum = filtered.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const sorted = [...filtered].sort((a, b) => a - b);
    const mid = Math.floor(count / 2);
    const median =
      count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const variance =
      filtered.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / count;
    const stddev = Math.sqrt(variance);
    return {
      count,
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stddev: Number(stddev.toFixed(2)),
      min: sorted[0],
      max: sorted[count - 1],
    };
  }

  async getAnalytics(
    firebaseUid: string,
    songId: string,
    limit = 50,
    offset = 0,
  ) {
    const userId = await this.getUserIdFromFirebase(firebaseUid);
    const supabase = getSupabaseClient();

    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select(
        'id, title, artist_id, artist_name, artwork_url, in_refinery, refinery_review_count, refinery_min_reviews, refinery_submitted_at',
      )
      .eq('id', songId)
      .single();
    if (songErr || !song) throw new NotFoundException('Song not found');
    if (song.artist_id !== userId) {
      throw new ForbiddenException('Only the artist can view review analytics');
    }

    const { data: customQs } = await supabase
      .from('refinery_custom_questions')
      .select('id, question_text, display_order')
      .eq('song_id', songId)
      .order('display_order', { ascending: true });

    const { data: allReviews, error: reviewsErr } = await supabase
      .from('refinery_reviews')
      .select(
        'id, overall_rating, beat_rating, lyrics_rating, chorus_rating, opening_ending_rating, survey_responses, custom_responses, comment, created_at, reviewer_id',
      )
      .eq('song_id', songId)
      .order('created_at', { ascending: false });
    if (reviewsErr) {
      this.logger.warn(`getAnalytics reviews error: ${reviewsErr.message}`);
      throw new BadRequestException('Failed to load reviews');
    }

    type ReviewRow = {
      id: string;
      overall_rating: number;
      beat_rating: number;
      lyrics_rating: number;
      chorus_rating: number;
      opening_ending_rating: number;
      survey_responses: Record<string, string> | null;
      custom_responses: Record<string, string> | null;
      comment: string | null;
      created_at: string;
      reviewer_id: string;
    };
    const reviews: ReviewRow[] = (allReviews ?? []) as ReviewRow[];

    // Per-rating stats
    const ratingStats: Record<RatingKey, RatingStats> = {
      overall_rating: this.summarizeRatings(reviews.map((r) => r.overall_rating)),
      beat_rating: this.summarizeRatings(reviews.map((r) => r.beat_rating)),
      lyrics_rating: this.summarizeRatings(reviews.map((r) => r.lyrics_rating)),
      chorus_rating: this.summarizeRatings(reviews.map((r) => r.chorus_rating)),
      opening_ending_rating: this.summarizeRatings(
        reviews.map((r) => r.opening_ending_rating),
      ),
    };

    // Survey response distributions
    const surveyDistributions: Record<string, Record<string, number>> = {};
    for (const q of REFINERY_SURVEY_QUESTIONS) {
      surveyDistributions[q.key] = {};
      for (const opt of q.options) surveyDistributions[q.key][opt] = 0;
    }
    for (const r of reviews) {
      const sr = r.survey_responses ?? {};
      for (const [key, value] of Object.entries(sr)) {
        if (surveyDistributions[key] && typeof value === 'string') {
          if (surveyDistributions[key][value] === undefined) {
            surveyDistributions[key][value] = 0;
          }
          surveyDistributions[key][value] += 1;
        }
      }
    }

    // Custom question distributions (free text -> count of responses)
    const customQuestionStats = (customQs ?? []).map(
      (q: { id: string; question_text: string; display_order: number }) => {
        const responses: string[] = [];
        for (const r of reviews) {
          const v = (r.custom_responses ?? {})[q.id];
          if (typeof v === 'string' && v.trim().length > 0) {
            responses.push(v);
          }
        }
        return {
          id: q.id,
          questionText: q.question_text,
          displayOrder: q.display_order,
          totalResponses: responses.length,
          recentResponses: responses.slice(0, 10),
        };
      },
    );

    // Outlier detection: any individual rating >2 stddev from mean for that rating
    const outlierIds = new Set<string>();
    for (const key of REFINERY_RATING_KEYS) {
      const stats = ratingStats[key];
      if (!stats || !stats.stddev || stats.stddev === 0 || !stats.mean) continue;
      const threshold = 2 * stats.stddev;
      for (const r of reviews) {
        const value = (r as unknown as Record<string, number>)[key];
        if (
          typeof value === 'number' &&
          Math.abs(value - stats.mean) > threshold
        ) {
          outlierIds.add(r.id);
        }
      }
    }

    const totalReviews = reviews.length;
    const paged = reviews.slice(offset, offset + limit).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      overallRating: r.overall_rating,
      beatRating: r.beat_rating,
      lyricsRating: r.lyrics_rating,
      chorusRating: r.chorus_rating,
      openingEndingRating: r.opening_ending_rating,
      surveyResponses: r.survey_responses ?? {},
      customResponses: r.custom_responses ?? {},
      comment: r.comment,
      isOutlier: outlierIds.has(r.id),
    }));

    return {
      song: {
        id: song.id,
        title: song.title,
        artistName: song.artist_name,
        artworkUrl: song.artwork_url,
        inRefinery: song.in_refinery,
        reviewCount: song.refinery_review_count ?? totalReviews,
        minReviews: song.refinery_min_reviews ?? REFINERY_DEFAULT_MIN_REVIEWS,
        submittedAt: song.refinery_submitted_at,
      },
      summary: {
        totalReviews,
        ratingStats,
        surveyDistributions,
        customQuestions: customQuestionStats,
        outlierCount: outlierIds.size,
      },
      reviews: paged,
      pagination: { limit, offset, total: totalReviews },
    };
  }

  // ---------------------------------------------------------------------------
  // Comments (kept for backward compatibility; existing UI uses these)
  // ---------------------------------------------------------------------------

  async getComments(songId: string, limit = 50, offset = 0) {
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, in_refinery')
      .eq('id', songId)
      .single();
    if (!song || !song.in_refinery) {
      throw new BadRequestException('Song not found or not in The Refinery');
    }

    const { data, error } = await supabase
      .from('refinery_comments')
      .select(
        `
        id,
        user_id,
        body,
        created_at,
        users:user_id ( display_name )
      `,
      )
      .eq('song_id', songId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException('Failed to load comments');
    return { comments: data ?? [], limit, offset };
  }

  async addComment(songId: string, userId: string, body: string) {
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, in_refinery')
      .eq('id', songId)
      .single();
    if (!song || !song.in_refinery) {
      throw new BadRequestException('Song not found or not in The Refinery');
    }
    const trimmed = (body ?? '').trim();
    if (!trimmed) throw new BadRequestException('Comment body is required');

    const { data: inserted, error } = await supabase
      .from('refinery_comments')
      .insert({
        user_id: userId,
        song_id: songId,
        body: trimmed,
        updated_at: new Date().toISOString(),
      })
      .select('id, body, created_at')
      .single();

    if (error) throw new BadRequestException('Failed to add comment');
    return inserted;
  }
}
