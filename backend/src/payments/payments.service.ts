import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

interface TransactionRow {
  id: string;
  user_id: string;
  amount_cents: number;
  credits_purchased: number;
  status: string;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  payment_method?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface CreditsRow {
  id: string;
  artist_id: string;
  balance: number;
  total_purchased: number;
  updated_at?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  async createPaymentIntent(userId: string, dto: CreatePaymentIntentDto) {
    const supabase = getSupabaseClient();

    // Create transaction record
    const { data: txData, error: txError } = await supabase
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

    const transaction = txData as TransactionRow;

    // Create Stripe payment intent
    const paymentIntent = await this.stripeService.createPaymentIntent(
      dto.amount,
      {
        userId,
        transactionId: transaction.id,
        credits: dto.credits.toString(),
      },
    );

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
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    const transaction = txData as TransactionRow | null;
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
      const { data: creditsData } = await supabase
        .from('credits')
        .select('*')
        .eq('artist_id', transaction.user_id)
        .single();

      const credits = creditsData as CreditsRow | null;
      if (credits) {
        await supabase
          .from('credits')
          .update({
            balance: credits.balance + transaction.credits_purchased,
            total_purchased:
              credits.total_purchased + transaction.credits_purchased,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credits.id);
      } else {
        // Create credit record if it doesn't exist
        await supabase.from('credits').insert({
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
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    const transaction = txData as TransactionRow | null;
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

    return (data ?? []) as TransactionRow[];
  }

  /**
   * Create a Stripe Checkout Session for web payments.
   * This is used by the web app instead of PaymentIntents.
   */
  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    const supabase = getSupabaseClient();
    const webUrl =
      this.configService.get<string>('WEB_URL') || 'http://localhost:3001';

    // Create transaction record
    const { data: txData, error: txError } = await supabase
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

    const transaction = txData as TransactionRow;

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
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    const transaction = txData as TransactionRow | null;
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
      const { data: creditsData } = await supabase
        .from('credits')
        .select('*')
        .eq('artist_id', transaction.user_id)
        .single();

      const credits = creditsData as CreditsRow | null;
      if (credits) {
        await supabase
          .from('credits')
          .update({
            balance: credits.balance + transaction.credits_purchased,
            total_purchased:
              credits.total_purchased + transaction.credits_purchased,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credits.id);
      } else {
        await supabase.from('credits').insert({
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
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    const transaction = txData as TransactionRow | null;
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
