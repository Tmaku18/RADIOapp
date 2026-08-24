import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { isProNetworxMessagingBetaFree } from './pro-network-subscription.constants';
import { isBetaAllFree } from '../common/beta-access';

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
  /** True while beta free-messaging is on. Clients should still promote price. */
  messagingBetaFree: boolean;
  /** True when the user may send Pro-Networx DMs (subscribed, admin path, or beta). */
  canMessage: boolean;
  /** True while beta unlocks every subscription feature, not just messaging. */
  betaFree: boolean;
};

@Injectable()
export class ProNetworkSubscriptionService {
  /**
   * True iff the user has an active or trialing subscription that has not
   * yet passed its current_period_end. Used to gate DMs and to reveal contact
   * info on Services listings.
   */
  isMessagingBetaFree(): boolean {
    return isProNetworxMessagingBetaFree() || isBetaAllFree();
  }

  /**
   * Whether this user may send Pro-Networx DMs. During beta this is always
   * true; otherwise it requires an active/trialing subscription.
   */
  async canSendMessages(userId: string): Promise<boolean> {
    if (this.isMessagingBetaFree()) return true;
    const access = await this.getAccess(userId);
    return access.hasAccess;
  }

  async getAccess(userId: string): Promise<ProNetworkAccess> {
    const supabase = getSupabaseClient();
    const messagingBetaFree = this.isMessagingBetaFree();
    const betaFree = isBetaAllFree();
    const { data, error } = await supabase
      .from('pro_network_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        hasAccess: betaFree,
        status: null,
        currentPeriodEnd: null,
        messagingBetaFree,
        canMessage: messagingBetaFree,
        betaFree,
      };
    }

    const status = data.status as ProNetworkSubStatus;
    const isActiveStatus = status === 'active' || status === 'trialing';
    const periodOk =
      !data.current_period_end ||
      new Date(data.current_period_end as string) > new Date();
    // Beta opens everything gated on hasAccess — feed comments and Services
    // contact info, not only DMs. Real status is still reported so the
    // manage-subscription UI stays accurate.
    const hasAccess = betaFree || (isActiveStatus && periodOk);
    return {
      hasAccess,
      status,
      currentPeriodEnd: (data.current_period_end as string | null) ?? null,
      messagingBetaFree,
      canMessage: messagingBetaFree || hasAccess,
      betaFree,
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
    store?: 'stripe' | 'app_store' | 'play';
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    appleOriginalTransactionId?: string | null;
    googlePurchaseToken?: string | null;
    googleOrderId?: string | null;
    storeProductId?: string | null;
    status: ProNetworkSubStatus;
    currentPeriodEnd?: Date | null;
    introCouponRedeemed?: boolean;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('pro_network_subscriptions')
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
      .from('pro_network_subscriptions')
      .upsert(updateRow, { onConflict: 'user_id' });
    if (error) {
      throw new Error(
        `Failed to persist Pro-Networx subscription: ${error.message}`,
      );
    }
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

  async getUserIdByAppleOriginalTransactionId(
    originalTransactionId: string,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('pro_network_subscriptions')
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
      .from('pro_network_subscriptions')
      .select('user_id')
      .eq('google_purchase_token', purchaseToken)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }
}
