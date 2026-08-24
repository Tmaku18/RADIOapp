import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { isBetaAllFree } from '../common/beta-access';

export type ProRadioSubStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type ProRadioAccess = {
  hasAccess: boolean;
  status: ProRadioSubStatus | null;
  currentPeriodEnd: string | null;
  /** True while beta unlocks Pro-Radio. Clients should still promote pricing. */
  betaFree: boolean;
};

@Injectable()
export class ProRadioSubscriptionService {
  async getAccess(userId: string): Promise<ProRadioAccess> {
    const betaFree = isBetaAllFree();
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('pro_radio_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        hasAccess: betaFree,
        status: null,
        currentPeriodEnd: null,
        betaFree,
      };
    }

    const status = data.status as ProRadioSubStatus;
    const isActiveStatus = status === 'active' || status === 'trialing';
    const periodOk =
      !data.current_period_end ||
      new Date(data.current_period_end as string) > new Date();
    return {
      // Real status is still reported so the manage-subscription UI stays
      // accurate for anyone who actually subscribed during beta.
      hasAccess: betaFree || (isActiveStatus && periodOk),
      status,
      currentPeriodEnd: (data.current_period_end as string | null) ?? null,
      betaFree,
    };
  }

  async hasNeverSubscribed(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('pro_radio_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) return false;
    return (count ?? 0) === 0;
  }

  async setSubscription(params: {
    userId: string;
    store?: 'stripe' | 'app_store' | 'play';
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    appleOriginalTransactionId?: string | null;
    googlePurchaseToken?: string | null;
    googleOrderId?: string | null;
    storeProductId?: string | null;
    status: ProRadioSubStatus;
    currentPeriodEnd?: Date | null;
    introCouponRedeemed?: boolean;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('pro_radio_subscriptions')
      .select('*')
      .eq('user_id', params.userId)
      .maybeSingle();

    const updateRow: Record<string, unknown> = {
      user_id: params.userId,
      status: params.status,
      current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
      store: params.store ?? existing?.store ?? 'stripe',
      stripe_subscription_id:
        params.stripeSubscriptionId !== undefined
          ? params.stripeSubscriptionId
          : (existing?.stripe_subscription_id ?? null),
      stripe_customer_id:
        params.stripeCustomerId !== undefined
          ? params.stripeCustomerId
          : (existing?.stripe_customer_id ?? null),
      apple_original_transaction_id:
        params.appleOriginalTransactionId !== undefined
          ? params.appleOriginalTransactionId
          : (existing?.apple_original_transaction_id ?? null),
      google_purchase_token:
        params.googlePurchaseToken !== undefined
          ? params.googlePurchaseToken
          : (existing?.google_purchase_token ?? null),
      google_order_id:
        params.googleOrderId !== undefined
          ? params.googleOrderId
          : (existing?.google_order_id ?? null),
      store_product_id:
        params.storeProductId !== undefined
          ? params.storeProductId
          : (existing?.store_product_id ?? null),
    };
    if (params.introCouponRedeemed === true) {
      updateRow.intro_coupon_redeemed = true;
    } else if (existing?.intro_coupon_redeemed != null) {
      updateRow.intro_coupon_redeemed = existing.intro_coupon_redeemed;
    }
    const { error } = await supabase
      .from('pro_radio_subscriptions')
      .upsert(updateRow, { onConflict: 'user_id' });
    if (error) {
      throw new Error(
        `Failed to persist Pro-Radio subscription: ${error.message}`,
      );
    }
  }

  async getUserIdByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('pro_radio_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }

  async getUserIdByAppleOriginalTransactionId(
    originalTransactionId: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('pro_radio_subscriptions')
      .select('user_id')
      .eq('apple_original_transaction_id', originalTransactionId)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }

  async getUserIdByGooglePurchaseToken(
    purchaseToken: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('pro_radio_subscriptions')
      .select('user_id')
      .eq('google_purchase_token', purchaseToken)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }
}
