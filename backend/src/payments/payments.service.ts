import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { StripeService } from './stripe.service';
import { GooglePlayBillingService } from './google-play-billing.service';
import { CreatorNetworkService } from '../creator-network/creator-network.service';
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

/** Flat $1.99 per play. Returns cents. */
export function pricePerPlayCents(durationSeconds: number): number {
  void durationSeconds;
  return 199;
}

@Injectable()
export class PaymentsService {
  constructor(
    private stripeService: StripeService,
    private configService: ConfigService,
    private creatorNetwork: CreatorNetworkService,
    private googlePlayBillingService: GooglePlayBillingService,
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

  private async addPlaysToSong(
    supabase: any,
    songId: string,
    plays: number,
  ): Promise<void> {
    const { data: song } = await supabase
      .from('songs')
      .select('credits_remaining')
      .eq('id', songId)
      .single();
    if (!song) return;
    await supabase
      .from('songs')
      .update({
        credits_remaining: (song.credits_remaining ?? 0) + plays,
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
    const pricePerPlayCentsVal = pricePerPlayCents(durationSeconds);
    const pricePerPlayDollars = (pricePerPlayCentsVal / 100).toFixed(2);

    const options = ALLOWED_PLAYS_LIST.map((plays) => {
      const totalCents = plays * pricePerPlayCentsVal;
      return {
        plays,
        totalCents,
        totalDollars: (totalCents / 100).toFixed(2),
      };
    });

    return {
      songId: song.id,
      title: song.title,
      durationSeconds,
      pricePerPlayCents: pricePerPlayCentsVal,
      pricePerPlayDollars,
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
      `${dto.plays} play(s) – ${price.title}`,
      `$${price.pricePerPlayDollars}/play ($${option.totalDollars} total)`,
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
}
