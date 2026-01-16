import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  constructor(private stripeService: StripeService) {}

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

  async handlePaymentSuccess(paymentIntentId: string) {
    const supabase = getSupabaseClient();

    // Find transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (!transaction || transaction.status === 'succeeded') {
      return;
    }

    // Update transaction status
    await supabase
      .from('transactions')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    // Update credits balance
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
    }
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
}
