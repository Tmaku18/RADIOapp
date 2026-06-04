import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { StripeService } from './stripe.service';
import { GooglePlayBillingService } from './google-play-billing.service';
import { CreatorNetworkService } from '../creator-network/creator-network.service';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import type { ProNetworkSubStatus } from '../pro-network-subscription/pro-network-subscription.service';
import { RefineryService } from '../refinery/refinery.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ALLOWED_PLAYS_LIST, BuySongPlaysDto } from './dto/buy-song-plays.dto';
import { CompleteGooglePlayPurchaseDto } from './dto/complete-google-play-purchase.dto';

type GooglePlayCatalogEntry = {
  type: 'credits' | 'song_plays';
  amountCents: number;
  credits?: number;
  plays?: number;
};

/**
 * A Discovery Placement is the unit artists buy to promote a track. Per the
 * NETWORX model, one placement costs a flat $1.99 and targets a delivery of
 * ~1,000 verified listener exposures (plays). The purchase quantity selected by
 * the artist is a number of placements; each placement grants
 * EXPOSURES_PER_PLACEMENT plays into the song's rotation budget.
 */
export const EXPOSURES_PER_PLACEMENT = 1000;

/** Flat $1.99 per discovery placement. Returns cents. */
export function pricePerPlacementCents(): number {
  return 199;
}

/**
 * @deprecated Pricing is now per discovery placement; this returns the flat
 * placement price for backward compatibility with existing callers.
 */
export function pricePerPlayCents(durationSeconds: number): number {
  void durationSeconds;
  return pricePerPlacementCents();
}

@Injectable()
export class PaymentsService {
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
    private creatorNetwork: CreatorNetworkService,
    private proNetworkSub: ProNetworkSubscriptionService,
    private googlePlayBillingService: GooglePlayBillingService,
    @Inject(forwardRef(() => RefineryService))
    private readonly refineryService: RefineryService,
  ) {}

  private getGooglePlayCatalog(): Record<string, GooglePlayCatalogEntry> {
    const raw = this.configService.get<string>(
      'GOOGLE_PLAY_PRODUCT_CATALOG_JSON',
    );
    if (!raw) {
      throw new Error(
        'GOOGLE_PLAY_PRODUCT_CATALOG_JSON is required to map Play products to credits/plays',
      );
    }
    const parsed = JSON.parse(raw) as Record<string, GooglePlayCatalogEntry>;
    return parsed;
  }

  private resolveGooglePlayProduct(productId: string): GooglePlayCatalogEntry {
    const catalog = this.getGooglePlayCatalog();
    const product = catalog[productId];
    if (!product) {
      throw new Error(`Unknown Google Play product: ${productId}`);
    }
    if (!product.amountCents || product.amountCents <= 0) {
      throw new Error(
        `Invalid catalog amountCents for Google Play product: ${productId}`,
      );
    }
    if (
      product.type === 'credits' &&
      (!product.credits || product.credits <= 0)
    ) {
      throw new Error(
        `Invalid credits mapping for Google Play product: ${productId}`,
      );
    }
    if (
      product.type === 'song_plays' &&
      (!product.plays ||
        !ALLOWED_PLAYS_LIST.includes(
          product.plays as (typeof ALLOWED_PLAYS_LIST)[number],
        ))
    ) {
      throw new Error(
        `Invalid plays mapping for Google Play product: ${productId}`,
      );
    }
    return product;
  }

  private async grantCreditsToArtist(
    supabase: any,
    userId: string,
    creditsPurchased: number,
  ): Promise<void> {
    const { error: rpcError } = await supabase.rpc('increment_credits', {
      p_artist_id: userId,
      p_amount: creditsPurchased,
    });

    if (rpcError) {
      console.error('Failed to increment credits via RPC:', rpcError.message);
      const { data: credits } = await supabase
        .from('credits')
        .select('*')
        .eq('artist_id', userId)
        .single();
      if (credits) {
        await supabase
          .from('credits')
          .update({
            balance: credits.balance + creditsPurchased,
            total_purchased: credits.total_purchased + creditsPurchased,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credits.id);
      } else {
        await supabase.from('credits').insert({
          artist_id: userId,
          balance: creditsPurchased,
          total_purchased: creditsPurchased,
        });
      }
    }
  }

  async completeGooglePlayPurchase(
    userId: string,
    dto: CompleteGooglePlayPurchaseDto,
  ) {
    const supabase = getSupabaseClient();
    const product = this.resolveGooglePlayProduct(dto.productId);
    const verification =
      await this.googlePlayBillingService.verifyManagedProductPurchase({
        productId: dto.productId,
        purchaseToken: dto.purchaseToken,
      });
    const orderId = verification.orderId ?? dto.purchaseToken;

    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_charge_id', orderId)
      .single();

    if (existingTransaction && existingTransaction.status === 'succeeded') {
      return {
        transactionId: existingTransaction.id,
        alreadyProcessed: true,
      };
    }

    const creditsPurchased =
      product.type === 'credits' ? (product.credits ?? 0) : 0;
    const playsPurchased =
      product.type === 'song_plays' ? (product.plays ?? 0) : null;
    const songId = product.type === 'song_plays' ? dto.songId : null;
    if (product.type === 'song_plays' && !songId) {
      throw new Error(
        'songId is required when completing a Google Play song_plays purchase',
      );
    }
    if (product.type === 'song_plays' && songId && playsPurchased != null) {
      const songPricing = await this.getSongPlayPrice(userId, songId);
      const selectedOption = songPricing.options.find(
        (option) => option.plays === playsPurchased,
      );
      if (!selectedOption) {
        throw new Error(
          `No pricing option found for plays=${playsPurchased} on song ${songId}`,
        );
      }
      if (selectedOption.totalCents !== product.amountCents) {
        throw new Error(
          `Google Play product amount mismatch. Expected ${selectedOption.totalCents} cents ` +
            `for song duration pricing, got ${product.amountCents}.`,
        );
      }
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: product.amountCents,
        credits_purchased: creditsPurchased,
        status: 'succeeded',
        payment_method: 'google_play',
        stripe_charge_id: orderId,
        stripe_payment_intent_id: dto.purchaseToken,
        song_id: songId,
        plays_purchased: playsPurchased,
      })
      .select()
      .single();

    if (txError) {
      throw new Error(
        `Failed to record Google Play transaction: ${txError.message}`,
      );
    }

    if (songId && playsPurchased != null) {
      await this.addPlaysToSong(supabase, songId, playsPurchased);
    } else if (creditsPurchased > 0) {
      await this.grantCreditsToArtist(supabase, userId, creditsPurchased);
    }

    return {
      transactionId: transaction.id,
      orderId,
      purchaseState: verification.purchaseState,
      acknowledgementState: verification.acknowledgementState,
      consumptionState: verification.consumptionState,
      creditsPurchased,
      playsPurchased,
    };
  }

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

    // Live-stream donations live in stream_donations (mobile PaymentSheet flow).
    const fulfilledDonation = await this.fulfillDonationByStripeRef(
      'stripe_payment_intent_id',
      paymentIntentId,
    );
    if (fulfilledDonation) return;

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

    if (transaction.purpose === 'refinery_submission' && transaction.song_id) {
      await this.refineryService.fulfillSubmission({
        songId: transaction.song_id,
        artistUserId: transaction.user_id,
      });
      return;
    }

    if (transaction.song_id != null && transaction.plays_purchased != null) {
      await this.addPlaysToSong(
        supabase,
        transaction.song_id,
        transaction.plays_purchased,
      );
      return;
    }

    const { error: rpcError } = await supabase.rpc('increment_credits', {
      p_artist_id: transaction.user_id,
      p_amount: transaction.credits_purchased,
    });

    if (rpcError) {
      console.error('Failed to increment credits via RPC:', rpcError.message);
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
   * Credits a song's rotation budget for purchased discovery placements.
   * `placements` is the number of $1.99 placements bought; each grants
   * EXPOSURES_PER_PLACEMENT plays (verified listener exposures).
   */
  private async addPlaysToSong(
    supabase: any,
    songId: string,
    placements: number,
  ): Promise<void> {
    const exposures = placements * EXPOSURES_PER_PLACEMENT;
    const { data: song } = await supabase
      .from('songs')
      .select('credits_remaining')
      .eq('id', songId)
      .single();
    if (!song) return;
    await supabase
      .from('songs')
      .update({
        credits_remaining: (song.credits_remaining ?? 0) + exposures,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId);
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
  async createCreatorNetworkCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const session =
      await this.stripeService.createCreatorNetworkCheckoutSession(
        userId,
        successUrl,
        cancelUrl,
      );
    return { sessionId: session.id, url: session.url };
  }

  private isCreatorNetworkSubscription(subscription: {
    items?: { data?: Array<{ price?: { id?: string } }> };
  }): boolean {
    const priceId = this.stripeService.getCreatorNetworkPriceId();
    if (!priceId) return false;
    const itemPriceId = subscription.items?.data?.[0]?.price?.id;
    return itemPriceId === priceId;
  }

  private mapStripeStatus(
    stripeStatus: string,
  ): 'active' | 'canceled' | 'past_due' {
    if (stripeStatus === 'active') return 'active';
    if (stripeStatus === 'canceled' || stripeStatus === 'unpaid')
      return 'canceled';
    return 'past_due';
  }

  async handleCreatorNetworkCheckoutCompleted(
    subscriptionId: string,
    userId: string,
  ): Promise<void> {
    const priceId = this.stripeService.getCreatorNetworkPriceId();
    if (!priceId) return;
    const subscription =
      await this.stripeService.getSubscription(subscriptionId);
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

  async handleCreatorNetworkSubscriptionUpdated(subscription: {
    id: string;
    status: string;
    current_period_end?: number;
    items?: { data?: Array<{ price?: { id?: string } }> };
  }): Promise<void> {
    const userId = await this.creatorNetwork.getUserIdByStripeSubscriptionId(
      subscription.id,
    );
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

  async handleCreatorNetworkSubscriptionDeleted(
    subscriptionId: string,
  ): Promise<void> {
    const userId =
      await this.creatorNetwork.getUserIdByStripeSubscriptionId(subscriptionId);
    if (!userId) return;
    await this.creatorNetwork.setSubscription({
      userId,
      stripeSubscriptionId: subscriptionId,
      status: 'canceled',
      currentPeriodEnd: null,
    });
  }

  // ---------------------------------------------------------------------------
  // Pro Networks subscription
  // ---------------------------------------------------------------------------

  /**
   * Create a Stripe Checkout Session for Pro Networks subscription. Applies
   * the duration:once intro coupon iff the user has never had a Pro Networks
   * subscription before.
   */
  async createProNetworxCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const applyIntroCoupon =
      await this.proNetworkSub.hasNeverSubscribed(userId);
    const session = await this.stripeService.createProNetworxCheckoutSession({
      userId,
      successUrl,
      cancelUrl,
      applyIntroCoupon,
    });
    return {
      sessionId: session.id,
      url: session.url,
      introCouponApplied: applyIntroCoupon,
    };
  }

  /**
   * Build the Stripe Payment Sheet payload for the mobile app to subscribe.
   * The actual subscription is created when the SetupIntent succeeds; the
   * webhook (setup_intent.succeeded) wires up the subscription using the
   * customer + payment method that the sheet collected.
   */
  async createProNetworxPaymentSheet(args: {
    userId: string;
    customerEmail?: string | null;
  }) {
    const applyIntroCoupon = await this.proNetworkSub.hasNeverSubscribed(
      args.userId,
    );
    return this.stripeService.createProNetworxPaymentSheet({
      userId: args.userId,
      customerEmail: args.customerEmail ?? null,
      applyIntroCoupon,
    });
  }

  private isProNetworxSubscription(subscription: {
    items?: { data?: Array<{ price?: { id?: string } }> };
  }): boolean {
    const priceId = this.stripeService.getProNetworxPriceId();
    if (!priceId) return false;
    const itemPriceId = subscription.items?.data?.[0]?.price?.id;
    return itemPriceId === priceId;
  }

  private mapStripeStatusFull(stripeStatus: string): ProNetworkSubStatus {
    const allowed: ProNetworkSubStatus[] = [
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused',
    ];
    return allowed.includes(stripeStatus as ProNetworkSubStatus)
      ? (stripeStatus as ProNetworkSubStatus)
      : 'incomplete';
  }

  async handleProNetworxCheckoutCompleted(
    subscriptionId: string,
    userId: string,
  ): Promise<void> {
    const priceId = this.stripeService.getProNetworxPriceId();
    if (!priceId) return;
    const subscription =
      await this.stripeService.getSubscription(subscriptionId);
    if (!this.isProNetworxSubscription(subscription)) return;
    const status = this.mapStripeStatusFull(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? null;
    const introRedeemed = (subscription.discounts ?? []).length > 0;
    await this.proNetworkSub.setSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status,
      currentPeriodEnd,
      introCouponRedeemed: introRedeemed,
    });
  }

  async handleProNetworxSubscriptionUpdated(subscription: {
    id: string;
    status: string;
    current_period_end?: number;
    customer?: string | { id: string };
    items?: { data?: Array<{ price?: { id?: string } }> };
  }): Promise<void> {
    const userId = await this.proNetworkSub.getUserIdByStripeSubscriptionId(
      subscription.id,
    );
    if (!userId) return;
    if (!this.isProNetworxSubscription(subscription)) return;
    const status = this.mapStripeStatusFull(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? null;
    await this.proNetworkSub.setSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status,
      currentPeriodEnd,
    });
  }

  async handleProNetworxSubscriptionDeleted(
    subscriptionId: string,
  ): Promise<void> {
    const userId =
      await this.proNetworkSub.getUserIdByStripeSubscriptionId(subscriptionId);
    if (!userId) return;
    await this.proNetworkSub.setSubscription({
      userId,
      stripeSubscriptionId: subscriptionId,
      status: 'canceled',
      currentPeriodEnd: null,
    });
  }

  /**
   * Mobile flow: when the SetupIntent succeeds we create the subscription on
   * the customer using the saved payment method.
   */
  async handleProNetworxSetupIntentSucceeded(setupIntent: {
    id: string;
    customer?: string | { id: string };
    metadata?: Record<string, string>;
  }): Promise<void> {
    const customerId =
      typeof setupIntent.customer === 'string'
        ? setupIntent.customer
        : setupIntent.customer?.id ?? null;
    const userId = setupIntent.metadata?.userId ?? null;
    const priceId =
      setupIntent.metadata?.priceId ??
      this.stripeService.getProNetworxPriceId();
    const couponId = setupIntent.metadata?.couponId || null;
    if (!customerId || !userId || !priceId) return;
    if (setupIntent.metadata?.productKey !== 'pro_networx_subscription') return;

    const subscription =
      await this.stripeService.createProNetworxSubscriptionOnCustomer({
        customerId,
        priceId,
        couponId: couponId ?? undefined,
      });

    const status = this.mapStripeStatusFull(subscription.status);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    await this.proNetworkSub.setSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status,
      currentPeriodEnd,
      introCouponRedeemed: !!couponId,
    });
  }

  async getTransactions(userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('transactions')
      .select('*, song:songs(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const { song, ...rest } = row;
      const songTitle =
        song && typeof song === 'object' && song !== null && 'title' in song
          ? (song as { title: string }).title
          : null;
      return { ...rest, song_title: songTitle };
    });
  }

  /**
   * Get price per play for a song ($1/min rounded up to nearest cent) and purchase options.
   * Song must be approved and owned by the user.
   */
  async getSongPlayPrice(userId: string, songId: string) {
    const supabase = getSupabaseClient();
    const { data: song, error } = await supabase
      .from('songs')
      .select('id, title, duration_seconds, status')
      .eq('id', songId)
      .eq('artist_id', userId)
      .single();

    if (error || !song) {
      throw new Error('Song not found or access denied');
    }
    if (song.status !== 'approved') {
      throw new Error('Song must be approved to purchase plays');
    }

    const durationSeconds = song.duration_seconds ?? 180;
    const pricePerPlacementCentsVal = pricePerPlacementCents();
    const pricePerPlacementDollars = (pricePerPlacementCentsVal / 100).toFixed(
      2,
    );

    // Each selectable quantity is a number of discovery placements. A placement
    // is a flat $1.99 and targets ~EXPOSURES_PER_PLACEMENT verified exposures.
    const options = ALLOWED_PLAYS_LIST.map((placements) => {
      const totalCents = placements * pricePerPlacementCentsVal;
      return {
        // `plays` retains its name for client/IAP compatibility but now counts
        // placements purchased (not individual plays).
        plays: placements,
        placements,
        exposures: placements * EXPOSURES_PER_PLACEMENT,
        totalCents,
        totalDollars: (totalCents / 100).toFixed(2),
      };
    });

    return {
      songId: song.id,
      title: song.title,
      durationSeconds,
      exposuresPerPlacement: EXPOSURES_PER_PLACEMENT,
      pricePerPlacementCents: pricePerPlacementCentsVal,
      pricePerPlacementDollars,
      // Legacy aliases kept so existing clients keep working during rollout.
      pricePerPlayCents: pricePerPlacementCentsVal,
      pricePerPlayDollars: pricePerPlacementDollars,
      options,
    };
  }

  /**
   * Create a Stripe Checkout Session for buying plays for a specific song (web app).
   */
  async createCheckoutSessionSongPlays(userId: string, dto: BuySongPlaysDto) {
    const supabase = getSupabaseClient();
    const webUrl =
      this.configService.get<string>('WEB_URL') || 'http://localhost:3001';

    const price = await this.getSongPlayPrice(userId, dto.songId);
    const option = price.options.find((o) => o.plays === dto.plays);
    if (!option) {
      throw new Error('Invalid plays amount');
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: option.totalCents,
        credits_purchased: 0,
        status: 'pending',
        payment_method: 'checkout_session',
        song_id: dto.songId,
        plays_purchased: dto.plays,
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to create transaction: ${txError.message}`);
    }

    const session = await this.stripeService.createCheckoutSessionSongPlays(
      option.totalCents,
      `${dto.plays} discovery placement${dto.plays === 1 ? '' : 's'} – ${price.title}`,
      `$${price.pricePerPlacementDollars}/placement · ~${option.exposures.toLocaleString()} verified exposures ($${option.totalDollars} total)`,
      {
        userId,
        transactionId: transaction.id,
        songId: dto.songId,
        plays: dto.plays.toString(),
      },
      `${webUrl}/artist/songs?success=true&session_id={CHECKOUT_SESSION_ID}`,
      `${webUrl}/artist/songs/${dto.songId}/buy-plays?canceled=true`,
    );

    await supabase
      .from('transactions')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', transaction.id);

    return {
      sessionId: session.id,
      url: session.url,
      transactionId: transaction.id,
    };
  }

  /**
   * Create a PaymentIntent for buying plays for a specific song (mobile app).
   */
  async createPaymentIntentSongPlays(userId: string, dto: BuySongPlaysDto) {
    const supabase = getSupabaseClient();

    const price = await this.getSongPlayPrice(userId, dto.songId);
    const option = price.options.find((o) => o.plays === dto.plays);
    if (!option) {
      throw new Error('Invalid plays amount');
    }

    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount_cents: option.totalCents,
        credits_purchased: 0,
        status: 'pending',
        song_id: dto.songId,
        plays_purchased: dto.plays,
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to create transaction: ${txError.message}`);
    }

    const paymentIntent = await this.stripeService.createPaymentIntent(
      option.totalCents,
      {
        userId,
        transactionId: transaction.id,
        songId: dto.songId,
        plays: dto.plays.toString(),
      },
    );

    await supabase
      .from('transactions')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', transaction.id);

    return {
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id,
    };
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

    // Live-stream donations (web Checkout flow) are tracked in stream_donations.
    const fulfilledDonation = await this.fulfillDonationByStripeRef(
      'stripe_checkout_session_id',
      sessionId,
    );
    if (fulfilledDonation) return;

    // Song purchases are tracked in song_purchases (not transactions). Fulfill
    // those first and short-circuit if this session was a song purchase.
    const fulfilledSongPurchase =
      await this.fulfillSongPurchaseBySession(sessionId);
    if (fulfilledSongPurchase) return;

    // Find transaction by checkout session ID
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (!transaction || transaction.status === 'succeeded') {
      return; // Already processed or not found
    }

    await supabase
      .from('transactions')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (transaction.purpose === 'refinery_submission' && transaction.song_id) {
      await this.refineryService.fulfillSubmission({
        songId: transaction.song_id,
        artistUserId: transaction.user_id,
      });
      return;
    }

    if (transaction.song_id != null && transaction.plays_purchased != null) {
      await this.addPlaysToSong(
        supabase,
        transaction.song_id,
        transaction.plays_purchased,
      );
      return;
    }

    const { error: rpcError } = await supabase.rpc('increment_credits', {
      p_artist_id: transaction.user_id,
      p_amount: transaction.credits_purchased,
    });

    if (rpcError) {
      console.error('Failed to increment credits via RPC:', rpcError.message);
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

  // ---------------------------------------------------------------------------
  // Stripe Connect (Express) — artist onboarding + status
  // ---------------------------------------------------------------------------

  private getWebBaseUrl(): string {
    return this.configService.get<string>('WEB_URL') || 'http://localhost:3001';
  }

  /** Read the artist's Connect account state, refreshing flags from Stripe. */
  async getConnectStatus(userId: string): Promise<{
    accountId: string | null;
    onboarded: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const supabase = getSupabaseClient();
    const { data: userRow } = await supabase
      .from('users')
      .select(
        'id, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted',
      )
      .eq('id', userId)
      .single();

    const accountId =
      (userRow as { stripe_connect_account_id?: string | null })
        ?.stripe_connect_account_id ?? null;
    if (!accountId) {
      return {
        accountId: null,
        onboarded: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    // Refresh from Stripe so flags reflect the latest onboarding state.
    try {
      const account = await this.stripeService.retrieveAccount(accountId);
      const chargesEnabled = account.charges_enabled === true;
      const payoutsEnabled = account.payouts_enabled === true;
      const detailsSubmitted = account.details_submitted === true;
      await supabase
        .from('users')
        .update({
          stripe_connect_charges_enabled: chargesEnabled,
          stripe_connect_payouts_enabled: payoutsEnabled,
          stripe_connect_details_submitted: detailsSubmitted,
          stripe_connect_onboarded_at:
            chargesEnabled && detailsSubmitted ? new Date().toISOString() : null,
        })
        .eq('id', userId);
      return {
        accountId,
        onboarded: chargesEnabled && detailsSubmitted,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
      };
    } catch {
      return {
        accountId,
        onboarded:
          (userRow as { stripe_connect_charges_enabled?: boolean })
            ?.stripe_connect_charges_enabled === true,
        chargesEnabled:
          (userRow as { stripe_connect_charges_enabled?: boolean })
            ?.stripe_connect_charges_enabled === true,
        payoutsEnabled:
          (userRow as { stripe_connect_payouts_enabled?: boolean })
            ?.stripe_connect_payouts_enabled === true,
        detailsSubmitted:
          (userRow as { stripe_connect_details_submitted?: boolean })
            ?.stripe_connect_details_submitted === true,
      };
    }
  }

  /** Create (if needed) an Express account and return an onboarding link. */
  async startConnectOnboarding(
    userId: string,
    options?: { returnUrl?: string; refreshUrl?: string },
  ): Promise<{ url: string; accountId: string }> {
    const supabase = getSupabaseClient();
    const { data: userRow } = await supabase
      .from('users')
      .select('id, email, stripe_connect_account_id')
      .eq('id', userId)
      .single();
    if (!userRow) throw new Error('User not found');

    let accountId =
      (userRow as { stripe_connect_account_id?: string | null })
        .stripe_connect_account_id ?? null;
    if (!accountId) {
      const account = await this.stripeService.createExpressAccount({
        email: (userRow as { email?: string | null }).email ?? null,
        userId,
      });
      accountId = account.id;
      await supabase
        .from('users')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', userId);
    }

    const base = this.getWebBaseUrl();
    const link = await this.stripeService.createAccountOnboardingLink({
      accountId,
      returnUrl: options?.returnUrl || `${base}/artist/payouts?connect=done`,
      refreshUrl: options?.refreshUrl || `${base}/artist/payouts?connect=refresh`,
    });
    return { url: link.url, accountId };
  }

  /** Express dashboard login link for an onboarded artist. */
  async createConnectLoginLink(userId: string): Promise<{ url: string }> {
    const supabase = getSupabaseClient();
    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_connect_account_id')
      .eq('id', userId)
      .single();
    const accountId =
      (userRow as { stripe_connect_account_id?: string | null })
        ?.stripe_connect_account_id ?? null;
    if (!accountId) {
      throw new Error('No connected account. Complete onboarding first.');
    }
    const link = await this.stripeService.createExpressLoginLink(accountId);
    return { url: link.url };
  }

  /** Webhook: refresh stored Connect flags when an account is updated. */
  async handleConnectAccountUpdated(account: {
    id: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const chargesEnabled = account.charges_enabled === true;
    const detailsSubmitted = account.details_submitted === true;
    await supabase
      .from('users')
      .update({
        stripe_connect_charges_enabled: chargesEnabled,
        stripe_connect_payouts_enabled: account.payouts_enabled === true,
        stripe_connect_details_submitted: detailsSubmitted,
        stripe_connect_onboarded_at:
          chargesEnabled && detailsSubmitted ? new Date().toISOString() : null,
      })
      .eq('stripe_connect_account_id', account.id);
  }

  // ---------------------------------------------------------------------------
  // Song purchases (one-time, destination charge to the artist)
  // ---------------------------------------------------------------------------

  /** Create a Checkout Session to buy a song; routes funds to the artist. */
  async createSongPurchaseCheckout(
    buyerUserId: string,
    songId: string,
    options?: { successUrl?: string; cancelUrl?: string },
  ): Promise<{ url: string | null; sessionId: string }> {
    const supabase = getSupabaseClient();

    const { data: song } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, price_cents, is_for_sale')
      .eq('id', songId)
      .single();
    if (!song) throw new Error('Song not found');
    if ((song as { is_for_sale?: boolean }).is_for_sale === false) {
      throw new Error('This song is not for sale');
    }
    if (song.artist_id === buyerUserId) {
      throw new Error('You already own your own song');
    }

    // Block double-purchase.
    const { data: existing } = await supabase
      .from('song_purchases')
      .select('id, status')
      .eq('user_id', buyerUserId)
      .eq('song_id', songId)
      .maybeSingle();
    if (existing && existing.status === 'completed') {
      throw new Error('You already purchased this song');
    }

    // Artist must have an onboarded Connect account to receive funds.
    const { data: artist } = await supabase
      .from('users')
      .select(
        'id, stripe_connect_account_id, stripe_connect_charges_enabled',
      )
      .eq('id', song.artist_id)
      .single();
    const destinationAccountId =
      (artist as { stripe_connect_account_id?: string | null })
        ?.stripe_connect_account_id ?? null;
    const chargesEnabled =
      (artist as { stripe_connect_charges_enabled?: boolean })
        ?.stripe_connect_charges_enabled === true;
    if (!destinationAccountId || !chargesEnabled) {
      throw new Error(
        'This artist is not yet set up to receive payments. Check back soon.',
      );
    }

    const amountCents = Math.max(
      50,
      Number((song as { price_cents?: number }).price_cents) ||
        this.stripeService.getDefaultSongPriceCents(),
    );
    const feeBps = this.stripeService.getSongSaleFeeBps();
    const applicationFeeCents = Math.min(
      amountCents,
      Math.round((amountCents * feeBps) / 10000),
    );

    const { data: buyer } = await supabase
      .from('users')
      .select('email')
      .eq('id', buyerUserId)
      .single();

    const base = this.getWebBaseUrl();
    const metadata: Record<string, string> = {
      purpose: 'song_purchase',
      songId: song.id,
      buyerUserId,
      artistId: song.artist_id,
    };
    const session =
      await this.stripeService.createSongPurchaseCheckoutSession({
        amountCents,
        productName: `${song.title}`,
        productDescription: `Buy "${song.title}" by ${song.artist_name ?? 'artist'}`,
        destinationAccountId,
        applicationFeeCents,
        metadata,
        customerEmail: (buyer as { email?: string | null })?.email ?? null,
        successUrl:
          options?.successUrl ||
          `${base}/browse/saved?tab=music&purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: options?.cancelUrl || `${base}/artist/${song.artist_id}`,
      });

    // Record a pending purchase keyed by the checkout session for fulfillment.
    await supabase.from('song_purchases').upsert(
      {
        user_id: buyerUserId,
        song_id: song.id,
        artist_id: song.artist_id,
        amount_cents: amountCents,
        platform_fee_cents: applicationFeeCents,
        artist_amount_cents: amountCents - applicationFeeCents,
        currency: 'usd',
        stripe_checkout_session_id: session.id,
        status: 'pending',
      },
      { onConflict: 'user_id,song_id' },
    );

    return { url: session.url, sessionId: session.id };
  }

  /** Mark a pending song purchase as completed. Returns true if one matched. */
  async fulfillSongPurchaseBySession(sessionId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data: purchase, error } = await supabase
      .from('song_purchases')
      .select('id, status')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();
    if (error || !purchase) return false;
    if (purchase.status === 'completed') return true;
    await supabase
      .from('song_purchases')
      .update({ status: 'completed' })
      .eq('id', purchase.id);
    return true;
  }

  /**
   * Mark a pending live-stream donation as succeeded. Returns true if a donation
   * matched the given Stripe reference (so the caller can short-circuit).
   */
  async fulfillDonationByStripeRef(
    column: 'stripe_payment_intent_id' | 'stripe_checkout_session_id',
    value: string,
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data: donation, error } = await supabase
      .from('stream_donations')
      .select('id, status')
      .eq(column, value)
      .maybeSingle();
    if (error || !donation) return false;
    if (donation.status === 'succeeded') return true;
    await supabase
      .from('stream_donations')
      .update({ status: 'succeeded' })
      .eq('id', donation.id);
    return true;
  }
}
