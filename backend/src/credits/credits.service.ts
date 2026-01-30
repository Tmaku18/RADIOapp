import { Injectable, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

interface AllocateRpcResult {
  success: boolean;
  error?: string;
  balance_before: number;
  balance_after: number;
  song_credits: number;
}

interface CreditsRow {
  balance: number;
  total_purchased: number;
  total_used: number;
}

/**
 * Service for managing credit allocations between artist bank and songs.
 * Uses PostgreSQL RPC functions for atomic transactions.
 */
@Injectable()
export class CreditsService {
  /**
   * Allocate credits from artist's bank to a specific song.
   * Uses atomic RPC function to ensure consistency.
   * 
   * @param artistId - The artist's Supabase user ID
   * @param songId - The target song ID
   * @param amount - Number of credits to allocate
   */
  async allocateCreditsToSong(artistId: string, songId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('allocate_credits', {
      p_artist_id: artistId,
      p_song_id: songId,
      p_amount: amount,
    });

    if (error) {
      throw new BadRequestException(`Failed to allocate credits: ${error.message}`);
    }

    const result = data as AllocateRpcResult;
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Allocation failed');
    }

    return {
      success: true,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      songCredits: result.song_credits,
    };
  }

  /**
   * Withdraw credits from a song back to artist's bank.
   * Uses atomic RPC function to ensure consistency.
   * 
   * @param artistId - The artist's Supabase user ID
   * @param songId - The source song ID
   * @param amount - Number of credits to withdraw
   */
  async withdrawCreditsFromSong(artistId: string, songId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('withdraw_credits', {
      p_artist_id: artistId,
      p_song_id: songId,
      p_amount: amount,
    });

    if (error) {
      throw new BadRequestException(`Failed to withdraw credits: ${error.message}`);
    }

    const result = data as AllocateRpcResult;
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Withdrawal failed');
    }

    return {
      success: true,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      songCredits: result.song_credits,
    };
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

    const row = credits as CreditsRow | null;
    if (!row) {
      return {
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
      };
    }

    return {
      balance: row.balance,
      totalPurchased: row.total_purchased,
      totalUsed: row.total_used,
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
      .select(`
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
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new BadRequestException(`Failed to fetch allocation history: ${error.message}`);
    }

    interface AllocationRow {
      id: string;
      amount: number;
      direction: string;
      balance_before: number;
      balance_after: number;
      created_at: string;
      songs: { id: string; title: string } | null;
    }
    const rows = (data ?? []) as AllocationRow[];
    return rows.map((a) => ({
      id: a.id,
      songId: a.songs?.id ?? null,
      songTitle: a.songs?.title ?? null,
      amount: a.amount,
      direction: a.direction,
      balanceBefore: a.balance_before,
      balanceAfter: a.balance_after,
      createdAt: a.created_at,
    }));
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
