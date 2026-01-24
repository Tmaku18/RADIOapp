import { Controller, Get, Query } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';

@Controller('credits')
export class CreditsController {
  @Get('balance')
  async getBalance(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .eq('artist_id', userData.id)
      .single();

    if (!credits) {
      return {
        balance: 0,
        totalPurchased: 0,
        totalUsed: 0,
      };
    }

    return {
      balance: credits.balance,
      totalPurchased: credits.total_purchased,
      totalUsed: credits.total_used,
    };
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
      throw new Error('User not found');
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
}
