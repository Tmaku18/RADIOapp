import { Controller, Get } from '@nestjs/common';
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
}
