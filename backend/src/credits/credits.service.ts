import { Injectable, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

/**
 * Placement budget lives on `songs.credits_remaining`.
 * The old credit bank + allocate/withdraw flow is retired.
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
   * Get artist's credit balance and allocation history.
   *
   * @param artistId - The artist's Supabase user ID
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

    if (!credits) {
      return {
        balance: placementBudget,
        placementBudget,
        totalPurchased: 0,
        totalUsed: 0,
      };
    }

    return {
      balance: placementBudget,
      placementBudget,
      totalPurchased: credits.total_purchased,
      totalUsed: credits.total_used,
    };
  }

  /**
   * Get allocation history for an artist.
   *
   * @param artistId - The artist's Supabase user ID
   * @param limit - Max records to return
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
        songs (
          id,
          title
        )
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

    return data.map((a) => {
      const song = a.songs as unknown as { id: string; title: string } | null;
      return {
        id: a.id,
        songId: song?.id,
        songTitle: song?.title,
        amount: a.amount,
        direction: a.direction,
        balanceBefore: a.balance_before,
        balanceAfter: a.balance_after,
        createdAt: a.created_at,
      };
    });
  }

  /**
   * Calculate credits required for a song's full play.
   * Formula: ceil(duration_seconds / 5)
   *
   * @param durationSeconds - Song duration in seconds
   */
  calculateCreditsForPlay(durationSeconds: number): number {
    return Math.ceil(durationSeconds / 5);
  }
}
