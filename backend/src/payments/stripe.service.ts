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
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
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
    const priceId = this.configService.get<string>(
      'STRIPE_CREATOR_NETWORK_PRICE_ID',
    );
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

  /**
   * Create a Checkout Session for buying plays for a specific song ($1/min per play).
   */
  async createCheckoutSessionSongPlays(
    amountCents: number,
    productName: string,
    productDescription: string,
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
              name: productName,
              description: productDescription,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  /** Return the configured Creator Network price ID, or null if not set. */
  getCreatorNetworkPriceId(): string | null {
    return (
      this.configService.get<string>('STRIPE_CREATOR_NETWORK_PRICE_ID') ?? null
    );
  }

  /** Return the configured Pro Networks price ID, or null if not set. */
  getProNetworxPriceId(): string | null {
    return (
      this.configService.get<string>('STRIPE_PRO_NETWORX_PRICE_ID') ?? null
    );
  }

  /** Return the configured Pro Networks intro coupon ID, or null if not set. */
  getProNetworxIntroCouponId(): string | null {
    return (
      this.configService.get<string>('STRIPE_PRO_NETWORX_INTRO_COUPON_ID') ??
      null
    );
  }

  /**
   * Create a Stripe Checkout Session for Pro Networks subscription.
   * Uses STRIPE_PRO_NETWORX_PRICE_ID. When the user has never subscribed
   * before and STRIPE_PRO_NETWORX_INTRO_COUPON_ID is configured, the intro
   * coupon (duration: once) is applied so the first invoice is discounted
   * and renewals charge the full price.
   */
  async createProNetworxCheckoutSession(args: {
    userId: string;
    successUrl: string;
    cancelUrl: string;
    applyIntroCoupon: boolean;
  }): Promise<Stripe.Checkout.Session> {
    const priceId = this.getProNetworxPriceId();
    if (!priceId) {
      throw new Error('STRIPE_PRO_NETWORX_PRICE_ID is not configured');
    }
    const couponId = this.getProNetworxIntroCouponId();
    const params: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: args.userId,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      allow_promotion_codes: false,
    };
    if (args.applyIntroCoupon && couponId) {
      params.discounts = [{ coupon: couponId }];
    }
    return this.stripe.checkout.sessions.create(params);
  }

  /**
   * Build the Stripe Payment Sheet payload for the mobile app to subscribe to
   * Pro Networks. Uses a SetupIntent on a brand-new Customer + a follow-up
   * subscription create on the webhook side.
   */
  async createProNetworxPaymentSheet(args: {
    userId: string;
    customerEmail?: string | null;
    applyIntroCoupon: boolean;
  }): Promise<{
    customerId: string;
    ephemeralKeySecret: string;
    setupIntentClientSecret: string;
    publishableKey: string | null;
    priceId: string;
    couponId: string | null;
  }> {
    const priceId = this.getProNetworxPriceId();
    if (!priceId) {
      throw new Error('STRIPE_PRO_NETWORX_PRICE_ID is not configured');
    }
    const couponId = this.getProNetworxIntroCouponId();

    const customer = await this.stripe.customers.create({
      email: args.customerEmail ?? undefined,
      metadata: { userId: args.userId },
    });
    const ephemeralKey = await this.stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2025-02-24.acacia' as unknown as string },
    );
    const setupIntent = await this.stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      metadata: {
        userId: args.userId,
        productKey: 'pro_networx_subscription',
        priceId,
        couponId: args.applyIntroCoupon && couponId ? couponId : '',
      },
    });
    return {
      customerId: customer.id,
      ephemeralKeySecret: ephemeralKey.secret ?? '',
      setupIntentClientSecret: setupIntent.client_secret ?? '',
      publishableKey:
        this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') ?? null,
      priceId,
      couponId: args.applyIntroCoupon && couponId ? couponId : null,
    };
  }

  /** Create a subscription on an existing customer + payment method. */
  async createProNetworxSubscriptionOnCustomer(args: {
    customerId: string;
    priceId: string;
    couponId?: string | null;
  }): Promise<Stripe.Subscription> {
    const params: Stripe.SubscriptionCreateParams = {
      customer: args.customerId,
      items: [{ price: args.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    };
    if (args.couponId) {
      params.discounts = [{ coupon: args.couponId }];
    }
    return this.stripe.subscriptions.create(params);
  }

  /** Fetch a subscription by ID (for webhook handling). */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  // ---------------------------------------------------------------------------
  // Stripe Connect (Express) — artist payouts for song sales
  // ---------------------------------------------------------------------------

  /** Platform fee (basis points) retained on each song sale. Default 15%. */
  getSongSaleFeeBps(): number {
    const raw = this.configService.get<string>('SONG_SALE_PLATFORM_FEE_BPS');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) return 1500;
    return parsed;
  }

  /** Default flat song price in cents (configurable). */
  getDefaultSongPriceCents(): number {
    const raw = this.configService.get<string>('SONG_PRICE_CENTS');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed < 50) return 99;
    return parsed;
  }

  /** Create an Express connected account for an artist. */
  async createExpressAccount(args: {
    email?: string | null;
    userId: string;
  }): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type: 'express',
      email: args.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: 'individual',
      metadata: { userId: args.userId },
    });
  }

  /** Create a single-use onboarding link for an Express account. */
  async createAccountOnboardingLink(args: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<Stripe.AccountLink> {
    return this.stripe.accountLinks.create({
      account: args.accountId,
      refresh_url: args.refreshUrl,
      return_url: args.returnUrl,
      type: 'account_onboarding',
    });
  }

  /** Create a login link to the Express dashboard (for onboarded accounts). */
  async createExpressLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    return this.stripe.accounts.createLoginLink(accountId);
  }

  /** Retrieve a connected account (to read charges/payouts enabled state). */
  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  /**
   * Create a one-time Checkout Session for purchasing a song, routing funds to
   * the artist's connected account (destination charge) minus the platform fee.
   */
  async createSongPurchaseCheckoutSession(args: {
    amountCents: number;
    productName: string;
    productDescription: string;
    destinationAccountId: string;
    applicationFeeCents: number;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string | null;
  }): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: args.customerEmail ?? undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: args.productName,
              description: args.productDescription,
            },
            unit_amount: args.amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: args.applicationFeeCents,
        transfer_data: { destination: args.destinationAccountId },
        metadata: args.metadata,
      },
      metadata: args.metadata,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });
  }
}
