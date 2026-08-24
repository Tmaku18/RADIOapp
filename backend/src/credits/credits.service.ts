import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { isBetaAllFree } from '../common/beta-access';
import {
  SIGNUP_WELCOME_PLACEMENTS,
  WELCOME_EXPOSURES_PER_PLACEMENT,
  ensureWelcomePlacements,
} from './welcome-placements';

/**
 * Placement budget lives on `songs.credits_remaining`.
 * The old credit bank + allocate/withdraw flow is retired.
 * Artists/producers get SIGNUP_WELCOME_PLACEMENTS at signup; those stay locked
 * until beta ends (`BETA_ALL_FREE=false`).
 */
@Injectable()
export class CreditsService {
  /**
   * Retired: artists buy placements per song instead of allocating a bank.
   */
  async allocateCreditsToSong(
    _artistId: string,
    _songId: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    throw new BadRequestException(
      'Credits are no longer used. Buy placements for a song from My Songs.',
    );
  }

  /**
   * Retired: artists buy placements per song instead of withdrawing a bank.
   */
  async withdrawCreditsFromSong(
    _artistId: string,
    _songId: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    throw new BadRequestException(
      'Credits are no longer used. Buy placements for a song from My Songs.',
    );
  }

  /**
   * Get artist's credit balance, placement budget, and welcome bonus status.
   */
  async getArtistCredits(artistId: string) {
    const supabase = getSupabaseClient();

    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .eq('artist_id', artistId)
      .single();

    const { data: songs } = await supabase
      .from('songs')
      .select('credits_remaining')
      .eq('artist_id', artistId);
    const placementBudget = (songs ?? []).reduce(
      (sum, song) => sum + (Number(song.credits_remaining) || 0),
      0,
    );

    const welcomeRemaining = Number(
      credits?.welcome_placements_remaining ?? 0,
    );
    const betaFree = isBetaAllFree();
    const welcomeAvailable = !betaFree && welcomeRemaining > 0;

    if (!credits) {
      return {
        balance: placementBudget,
        placementBudget,
        totalPurchased: 0,
        totalUsed: 0,
        welcomePlacementsRemaining: 0,
        welcomePlacementsGranted: SIGNUP_WELCOME_PLACEMENTS,
        welcomePlacementsLocked: betaFree,
        welcomePlacementsAvailable: false,
      };
    }

    return {
      balance: placementBudget,
      placementBudget,
      totalPurchased: credits.total_purchased,
      totalUsed: credits.total_used,
      welcomePlacementsRemaining: welcomeRemaining,
      welcomePlacementsGranted: SIGNUP_WELCOME_PLACEMENTS,
      welcomePlacementsLocked: betaFree && welcomeRemaining > 0,
      welcomePlacementsAvailable: welcomeAvailable,
    };
  }

  /**
   * Apply signup welcome Discovery placements to a song.
   * Blocked while beta all-free is on so the gift isn't burned during testing.
   */
  async applyWelcomePlacementsToSong(
    artistId: string,
    songId: string,
    placements: number,
  ) {
    if (!Number.isInteger(placements) || placements <= 0) {
      throw new BadRequestException('placements must be a positive whole number');
    }
    if (isBetaAllFree()) {
      throw new BadRequestException(
        'Your free Discovery plays unlock when beta ends. Hang onto them!',
      );
    }

    const supabase = getSupabaseClient();

    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, artist_id, title, credits_remaining, status')
      .eq('id', songId)
      .single();
    if (songError || !song) throw new NotFoundException('Song not found');
    if (song.artist_id !== artistId) {
      throw new ForbiddenException('You can only boost your own songs');
    }
    if (song.status !== 'approved') {
      throw new BadRequestException(
        'Only approved songs can receive Discovery placements.',
      );
    }

    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('welcome_placements_remaining')
      .eq('artist_id', artistId)
      .single();
    if (creditsError || !credits) {
      throw new BadRequestException('No welcome placements found on this account.');
    }
    const remaining = Number(credits.welcome_placements_remaining ?? 0);
    if (placements > remaining) {
      throw new BadRequestException(
        `You only have ${remaining} free Discovery play${remaining === 1 ? '' : 's'} left.`,
      );
    }

    const exposures = placements * WELCOME_EXPOSURES_PER_PLACEMENT;
    const { error: songUpdateError } = await supabase
      .from('songs')
      .update({
        credits_remaining: (song.credits_remaining ?? 0) + exposures,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId);
    if (songUpdateError) {
      throw new BadRequestException(
        `Failed to add placements to song: ${songUpdateError.message}`,
      );
    }

    // Guard on the balance we read so two concurrent splits can't spend the
    // same placement twice.
    const { data: debited, error: debitError } = await supabase
      .from('credits')
      .update({
        welcome_placements_remaining: remaining - placements,
        updated_at: new Date().toISOString(),
      })
      .eq('artist_id', artistId)
      .eq('welcome_placements_remaining', remaining)
      .select('artist_id');
    if (debitError || !debited || debited.length === 0) {
      // Best-effort rollback of song credits so we don't invent free plays.
      await supabase
        .from('songs')
        .update({
          credits_remaining: song.credits_remaining ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', songId);
      throw new BadRequestException(
        debitError
          ? `Failed to debit welcome placements: ${debitError.message}`
          : 'Your free plays changed while applying. Please try again.',
      );
    }

    return {
      songId,
      placementsApplied: placements,
      exposuresAdded: exposures,
      welcomePlacementsRemaining: remaining - placements,
      creditsRemaining: (song.credits_remaining ?? 0) + exposures,
    };
  }

  /** Re-export helper for callers that already have CreditsService. */
  async ensureWelcomePlacements(artistId: string): Promise<void> {
    await ensureWelcomePlacements(artistId);
  }

  /**
   * Get allocation history for an artist.
   */
  async getAllocationHistory(artistId: string, limit = 50) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('credit_allocations')
      .select(
        `
        id,
        amount,
        direction,
        balance_before,
        balance_after,
        created_at,
        song:songs(id, title)
      `,
      )
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new BadRequestException(
        `Failed to fetch allocation history: ${error.message}`,
      );
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const song = row.song as { id?: string; title?: string } | null;
      return {
        id: row.id,
        amount: row.amount,
        direction: row.direction,
        balanceBefore: row.balance_before,
        balanceAfter: row.balance_after,
        createdAt: row.created_at,
        songId: song?.id ?? null,
        songTitle: song?.title ?? null,
      };
    });
  }
}
