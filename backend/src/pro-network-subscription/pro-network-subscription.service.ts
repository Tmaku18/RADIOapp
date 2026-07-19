import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

/**
 * Status as stored in pro_network_subscriptions.status. Mirrors the Stripe
 * subscription status closely so we can reason about it directly.
 */
export type ProNetworkSubStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type ProNetworkAccess = {
  hasAccess: boolean;
  status: ProNetworkSubStatus | null;
  currentPeriodEnd: string | null;
};

@Injectable()
export class ProNetworkSubscriptionService {
  /**
   * True iff the user has an active or trialing subscription that has not
   * yet passed its current_period_end. Used to gate DMs and to reveal contact
   * info on Services listings.
   */
  async getAccess(userId: string): Promise<ProNetworkAccess> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pro_network_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { hasAccess: false, status: null, currentPeriodEnd: null };
    }

    const status = data.status as ProNetworkSubStatus;
    const isActiveStatus = status === 'active' || status === 'trialing';
    const periodOk =
      !data.current_period_end ||
      new Date(data.current_period_end as string) > new Date();
    return {
      hasAccess: isActiveStatus && periodOk,
      status,
      currentPeriodEnd: (data.current_period_end as string | null) ?? null,
    };
  }

  /**
   * True iff this user has never had a Pro Networks subscription row before.
   * Used to decide whether to apply the $5-off intro coupon on Checkout.
   */
  async hasNeverSubscribed(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('pro_network_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) return false;
    return (count ?? 0) === 0;
  }

  async setSubscription(params: {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    status: ProNetworkSubStatus;
    currentPeriodEnd?: Date | null;
    introCouponRedeemed?: boolean;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const updateRow: Record<string, unknown> = {
      user_id: params.userId,
      status: params.status,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      stripe_customer_id: params.stripeCustomerId ?? null,
      current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    };
    if (params.introCouponRedeemed === true) {
      updateRow.intro_coupon_redeemed = true;
    }
    await supabase
      .from('pro_network_subscriptions')
      .upsert(updateRow, { onConflict: 'user_id' });
  }

  async getUserIdByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('pro_network_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }
}
