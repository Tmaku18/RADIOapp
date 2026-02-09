import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class CreatorNetworkService {
  async hasCreatorNetworkAccess(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from('creator_network_subscriptions')
      .select('id, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!row) return false;
    if (row.current_period_end && new Date(row.current_period_end) <= new Date()) return false;
    return true;
  }

  async setSubscription(params: {
    userId: string;
    stripeSubscriptionId?: string;
    status: 'active' | 'canceled' | 'past_due';
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('creator_network_subscriptions').upsert(
      {
        user_id: params.userId,
        stripe_subscription_id: params.stripeSubscriptionId ?? null,
        status: params.status,
        current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  }

  async getUserIdByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('creator_network_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    return data?.user_id ?? null;
  }
}
