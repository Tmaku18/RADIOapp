import { Controller, Get, Post, Query, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { CreditsService } from './credits.service';
import { AllocateCreditsDto } from './dto/allocate-credits.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.creditsService.getArtistCredits(userData.id);
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    
    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        amountCents: t.amount_cents,
        currency: t.currency,
        creditsPurchased: t.credits_purchased,
        status: t.status,
        createdAt: t.created_at,
      })),
    };
  }

  /**
   * Get allocation history for the current artist.
   */
  @Get('allocations')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getAllocations(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
  ) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.creditsService.getAllocationHistory(userData.id, parsedLimit);
  }

  /**
   * Allocate credits from artist's bank to a specific song.
   */
  @Post('songs/:songId/allocate')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async allocateCredits(
    @CurrentUser() user: FirebaseUser,
    @Param('songId') songId: string,
    @Body() dto: AllocateCreditsDto,
  ) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.creditsService.allocateCreditsToSong(userData.id, songId, dto.amount);
  }

  /**
   * Withdraw credits from a song back to artist's bank.
   */
  @Post('songs/:songId/withdraw')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async withdrawCredits(
    @CurrentUser() user: FirebaseUser,
    @Param('songId') songId: string,
    @Body() dto: AllocateCreditsDto,
  ) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.creditsService.withdrawCreditsFromSong(userData.id, songId, dto.amount);
  }
}
