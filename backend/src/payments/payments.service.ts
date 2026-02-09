import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { StripeService } from './stripe.service';
import { CreatorNetworkService } from '../creator-network/creator-network.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
    private creatorNetwork: CreatorNetworkService,
  ) {}

  async createPaymentIntent(userId: string, dto: CreatePaymentIntentDto) {
    const supabase = getSupabaseClient();

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: dto.amount,
        credits_purchased: dto.credits,
        status: 'pending',
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to create transaction: ${txError.message}`);
    }

    // Create Stripe payment intent
    const paymentIntent = await this.stripeService.createPaymentIntent(dto.amount, {
      userId,
      transactionId: transaction.id,
      credits: dto.credits.toString(),
    });

    // Update transaction with payment intent ID
    await supabase
      .from('transactions')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq('id', transaction.id);

    return {
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id,
    };
  }

  /**
   * Handle successful PaymentIntent (mobile app flow).
   */
  async handlePaymentSuccess(paymentIntentId: string) {
    const supabase = getSupabaseClient();

    // Find transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!transaction || transaction.status === 'succeeded') {
      return; // Already processed or not found
    }

    // Update transaction status
    await supabase
      .from('transactions')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Update credits balance using atomic RPC function
    // This prevents race conditions when multiple payments complete simultaneously
    const { error: rpcError } = await supabase.rpc('increment_credits', {
      p_artist_id: transaction.user_id,
      p_amount: transaction.credits_purchased,
    });

    if (rpcError) {
      // Log error but don't fail - transaction was successful
      console.error('Failed to increment credits via RPC:', rpcError.message);
      
      // Fallback to direct update if RPC doesn't exist yet
      const { data: credits } = await supabase
        .from('credits')
        .select('*')
        .eq('artist_id', transaction.user_id)
        .single();

      if (credits) {
        await supabase
          .from('credits')
          .update({
            balance: credits.balance + transaction.credits_purchased,
            total_purchased: credits.total_purchased + transaction.credits_purchased,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credits.id);
      } else {
        // Create credit record if it doesn't exist
        await supabase
          .from('credits')
          .insert({
            artist_id: transaction.user_id,
            balance: transaction.credits_purchased,
            total_purchased: transaction.credits_purchased,
          });
      }
    }
  }

  /**
   * Handle failed PaymentIntent (mobile app flow).
   */
  async handlePaymentFailed(paymentIntentId: string) {
    const supabase = getSupabaseClient();

    // Find transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!transaction || transaction.status !== 'pending') {
      return; // Already processed or not found
    }

    // Update transaction status to failed
    await supabase
      .from('transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
  }

  /**
   * Create a Stripe Checkout Session for Creator Network subscription.
   */
  async createCreatorNetworkCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    const session = await this.stripeService.createCreatorNetworkCheckoutSession(userId, successUrl, cancelUrl);
    return { sessionId: session.id, url: session.url };
  }

  private isCreatorNetworkSubscription(subscription: { items?: { data?: Array<{ price?: { id?: string } }> } }): boolean {
    const priceId = this.stripeService.getCreatorNetworkPriceId();
    if (!priceId) return false;
    const itemPriceId = subscription.items?.data?.[0]?.price?.id;
    return itemPriceId === priceId;
  }

  private mapStripeStatus(stripeStatus: string): 'active' | 'canceled' | 'past_due' {
    if (stripeStatus === 'active') return 'active';
    if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') return 'canceled';
    return 'past_due';
  }

  async handleCreatorNetworkCheckoutCompleted(subscriptionId: string, userId: string): Promise<void> {
    const priceId = this.stripeService.getCreatorNetworkPriceId();
    if (!priceId) return;
    const subscription = await this.stripeService.getSubscription(subscriptionId);
    if (!this.isCreatorNetworkSubscription(subscription)) return;
    const status = this.mapStripeStatus(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    await this.creatorNetwork.setSubscription({
      userId,
      stripeSubscriptionId: subscriptionId,
      status,
      currentPeriodEnd,
    });
  }

  async handleCreatorNetworkSubscriptionUpdated(
    subscription: { id: string; status: string; current_period_end?: number; items?: { data?: Array<{ price?: { id?: string } }> } },
  ): Promise<void> {
    const userId = await this.creatorNetwork.getUserIdByStripeSubscriptionId(subscription.id);
    if (!userId) return;
    if (!this.isCreatorNetworkSubscription(subscription)) return;
    const status = this.mapStripeStatus(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    await this.creatorNetwork.setSubscription({
      userId,
      stripeSubscriptionId: subscription.id,
      status,
      currentPeriodEnd,
    });
  }

  async handleCreatorNetworkSubscriptionDeleted(subscriptionId: string): Promise<void> {
    const userId = await this.creatorNetwork.getUserIdByStripeSubscriptionId(subscriptionId);
    if (!userId) return;
    await this.creatorNetwork.setSubscription({
      userId,
      stripeSubscriptionId: subscriptionId,
      status: 'canceled',
      currentPeriodEnd: null,
    });
  }

  async getTransactions(userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a Stripe Checkout Session for web payments.
   * This is used by the web app instead of PaymentIntents.
   */
  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const supabase = getSupabaseClient();
    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:3001';

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: dto.amount,
        credits_purchased: dto.credits,
        status: 'pending',
        payment_method: 'checkout_session',
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to create transaction: ${txError.message}`);
    }

    // Create Stripe Checkout Session
    const session = await this.stripeService.createCheckoutSession(
      dto.amount,
      dto.credits,
      {
        userId,
        transactionId: transaction.id,
        credits: dto.credits.toString(),
      },
      `${webUrl}/artist/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      `${webUrl}/artist/credits?canceled=true`,
    );

    // Update transaction with checkout session ID
    await supabase
      .from('transactions')
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq('id', transaction.id);

    return {
      sessionId: session.id,
      url: session.url,
      transactionId: transaction.id,
    };
  }

  /**
   * Handle successful checkout session completion.
   * Called from webhook when checkout.session.completed fires.
   */
  async handleCheckoutSessionCompleted(sessionId: string) {
    const supabase = getSupabaseClient();

    // Find transaction by checkout session ID
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (!transaction || transaction.status === 'succeeded') {
      return; // Already processed or not found
    }

    // Update transaction status
    await supabase
      .from('transactions')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Update credits balance using atomic RPC function
    const { error: rpcError } = await supabase.rpc('increment_credits', {
      p_artist_id: transaction.user_id,
      p_amount: transaction.credits_purchased,
    });

    if (rpcError) {
      console.error('Failed to increment credits via RPC:', rpcError.message);
      
      // Fallback to direct update
      const { data: credits } = await supabase
        .from('credits')
        .select('*')
        .eq('artist_id', transaction.user_id)
        .single();

      if (credits) {
        await supabase
          .from('credits')
          .update({
            balance: credits.balance + transaction.credits_purchased,
            total_purchased: credits.total_purchased + transaction.credits_purchased,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credits.id);
      } else {
        await supabase
          .from('credits')
          .insert({
            artist_id: transaction.user_id,
            balance: transaction.credits_purchased,
            total_purchased: transaction.credits_purchased,
          });
      }
    }
  }

  /**
   * Handle failed or expired checkout session (web app flow).
   * Called when checkout.session.expired or checkout.session.async_payment_failed fires.
   */
  async handleCheckoutSessionFailed(sessionId: string) {
    const supabase = getSupabaseClient();

    // Find transaction by checkout session ID
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (!transaction || transaction.status !== 'pending') {
      return; // Already processed or not found
    }

    // Update transaction status to failed/expired
    await supabase
      .from('transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);
  }
}
