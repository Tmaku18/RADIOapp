import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createPaymentIntent(amount: number, metadata: Record<string, string>) {
    return this.stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata,
    });
  }

  async verifyWebhookSignature(payload: string, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Create a Stripe Checkout Session for web payments.
   * This redirects users to Stripe's hosted payment page.
   */
  async createCheckoutSession(
    amount: number,
    credits: number,
    metadata: Record<string, string>,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${credits} Radio Credits`,
              description: `Purchase ${credits} credits for radio airplay`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  /**
   * Create a Stripe Checkout Session for Creator Network subscription.
   * Uses STRIPE_CREATOR_NETWORK_PRICE_ID (required). client_reference_id = internal user id (UUID).
   */
  async createCreatorNetworkCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    const priceId = this.configService.get<string>('STRIPE_CREATOR_NETWORK_PRICE_ID');
    if (!priceId) {
      throw new Error('STRIPE_CREATOR_NETWORK_PRICE_ID is not configured');
    }
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  /** Return the configured Creator Network price ID, or null if not set. */
  getCreatorNetworkPriceId(): string | null {
    return this.configService.get<string>('STRIPE_CREATOR_NETWORK_PRICE_ID') ?? null;
  }

  /** Fetch a subscription by ID (for webhook handling). */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }
}
