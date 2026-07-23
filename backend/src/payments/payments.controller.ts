import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { BuySongPlaysDto } from './dto/buy-song-plays.dto';
import { CompleteGooglePlayPurchaseDto } from './dto/complete-google-play-purchase.dto';
import { CompleteAppStorePurchaseDto } from './dto/complete-app-store-purchase.dto';
import {
  CompleteAppStoreSubscriptionDto,
  CompleteGooglePlaySubscriptionDto,
} from './dto/complete-store-subscription.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('create-intent')
  async createPaymentIntent(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreatePaymentIntentDto,
    @Headers('x-client-platform') platform?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    return this.paymentsService.createPaymentIntent(
      userData.id,
      dto,
      platform,
    );
  }

  @Post('google-play/complete')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener')
  async completeGooglePlayPurchase(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CompleteGooglePlayPurchaseDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) {
      throw new Error('User not found');
    }
    return this.paymentsService.completeGooglePlayPurchase(userData.id, dto);
  }

  @Post('app-store/complete')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener')
  async completeAppStorePurchase(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CompleteAppStorePurchaseDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) {
      throw new Error('User not found');
    }
    return this.paymentsService.completeAppStorePurchase(userData.id, dto);
  }

  @Post('app-store/complete-subscription')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener')
  async completeAppStoreSubscription(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CompleteAppStoreSubscriptionDto,
  ) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.completeAppStoreSubscription(userId, dto);
  }

  @Post('google-play/complete-subscription')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener')
  async completeGooglePlaySubscription(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CompleteGooglePlaySubscriptionDto,
  ) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.completeGooglePlaySubscription(userId, dto);
  }

  /** App Store Server Notifications V2 (ASSN). Configure in App Store Connect. */
  @Public()
  @Post('app-store/notifications')
  async appStoreNotifications(@Body() body: { signedPayload?: string }) {
    if (!body?.signedPayload) {
      throw new Error('signedPayload is required');
    }
    return this.paymentsService.handleAppStoreNotification(body.signedPayload);
  }

  /** Google Play Real-time developer notifications (Pub/Sub push). */
  @Public()
  @Post('google-play/rtdn')
  async googlePlayRtdn(
    @Body()
    body: {
      message?: { data?: string };
      subscriptionNotification?: {
        notificationType?: number;
        purchaseToken?: string;
        subscriptionId?: string;
      };
    },
  ) {
    return this.paymentsService.handleGooglePlayRtdn(body);
  }

  /**
   * Get discovery-placement pricing for a song. Each placement is a flat $1.99
   * targeting ~1,000 verified listener exposures; quantities 1/3/5/10/25/50/100.
   */
  @Get('song-play-price')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  async getSongPlayPrice(
    @CurrentUser() user: FirebaseUser,
    @Query('songId') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.paymentsService.getSongPlayPrice(userData.id, songId);
  }

  /**
   * Create a Stripe Checkout Session for buying plays for a song (web app).
   */
  @Post('checkout-session-song-plays')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  async createCheckoutSessionSongPlays(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: BuySongPlaysDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.paymentsService.createCheckoutSessionSongPlays(
      userData.id,
      dto,
    );
  }

  /**
   * Quick-buy CTA while listening to your own track: purchases a single $1.99
   * discovery placement (~1,000 verified exposures) for the specified song.
   * Apple/Google Pay are available via Stripe Checkout when supported.
   */
  @Post('quick-add-minutes')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  async quickAddMinutes(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { songId: string },
  ) {
    if (!body?.songId) {
      throw new Error('songId is required');
    }
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.paymentsService.createCheckoutSessionSongPlays(userData.id, {
      songId: body.songId,
      plays: 1,
    } as BuySongPlaysDto);
  }

  /**
   * Create a PaymentIntent for buying plays for a song (mobile app).
   */
  @Post('create-intent-song-plays')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  async createPaymentIntentSongPlays(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: BuySongPlaysDto,
    @Headers('x-client-platform') platform?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.paymentsService.createPaymentIntentSongPlays(
      userData.id,
      dto,
      platform,
    );
  }

  /**
   * Create a Stripe Checkout Session for web payments.
   * This redirects users to Stripe's hosted payment page.
   * Used by the web app (mobile app uses create-intent instead).
   */
  @Post('create-checkout-session')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async createCheckoutSession(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    return this.paymentsService.createCheckoutSession(userData.id, dto);
  }

  /**
   * Create a Stripe Checkout Session for Creator Network subscription.
   * Redirects to Stripe hosted checkout. Requires STRIPE_CREATOR_NETWORK_PRICE_ID.
   */
  @Post('create-creator-network-checkout-session')
  @UseGuards(FirebaseAuthGuard)
  async createCreatorNetworkCheckoutSession(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { successUrl?: string; cancelUrl?: string },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    const webUrl = process.env.WEB_URL || 'http://localhost:3001';
    const successUrl =
      body.successUrl || `${webUrl}/profile?creator_network=success`;
    const cancelUrl =
      body.cancelUrl || `${webUrl}/profile?creator_network=canceled`;
    return this.paymentsService.createCreatorNetworkCheckoutSession(
      userData.id,
      successUrl,
      cancelUrl,
    );
  }

  /**
   * Create a Stripe Checkout Session for Pro Networks subscription
   * ($9.99/mo, $4.99 first month via duration:once coupon).
   */
  @Post('create-pro-networx-checkout-session')
  @UseGuards(FirebaseAuthGuard)
  async createProNetworxCheckoutSession(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { successUrl?: string; cancelUrl?: string },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    const webUrl = process.env.WEB_URL || 'http://localhost:3001';
    const successUrl =
      body.successUrl || `${webUrl}/pro-networx/home?pro_networx=success`;
    const cancelUrl =
      body.cancelUrl || `${webUrl}/pro-networx?pro_networx=canceled`;
    return this.paymentsService.createProNetworxCheckoutSession(
      userData.id,
      successUrl,
      cancelUrl,
    );
  }

  /**
   * Build Stripe Payment Sheet payload for the mobile app.
   */
  @Post('create-pro-networx-payment-sheet')
  @UseGuards(FirebaseAuthGuard)
  async createProNetworxPaymentSheet(
    @CurrentUser() user: FirebaseUser,
    @Headers('x-client-platform') platform?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id, email')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new Error('User not found');
    return this.paymentsService.createProNetworxPaymentSheet({
      userId: userData.id,
      customerEmail: (userData as { email?: string }).email ?? null,
      platform,
    });
  }

  // ─── Stripe Connect (artist payouts) ────────────────────────────────

  private async resolveUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (!data) throw new Error('User not found');
    return data.id;
  }

  /** Begin (or resume) Stripe Connect Express onboarding for the artist. */
  @Post('connect/onboard')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async connectOnboard(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { returnUrl?: string; refreshUrl?: string },
  ) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.startConnectOnboarding(userId, {
      returnUrl: body?.returnUrl,
      refreshUrl: body?.refreshUrl,
    });
  }

  /** Current Connect onboarding/payout status for the artist. */
  @Get('connect/status')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async connectStatus(@CurrentUser() user: FirebaseUser) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.getConnectStatus(userId);
  }

  /** Express dashboard login link (for an onboarded artist). */
  @Post('connect/login-link')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async connectLoginLink(@CurrentUser() user: FirebaseUser) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.createConnectLoginLink(userId);
  }

  // ─── Song purchases ──────────────────────────────────────────────────

  /** Create a Checkout Session to buy a song (full ownership + download). */
  @Post('songs/:songId/checkout')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async createSongPurchaseCheckout(
    @CurrentUser() user: FirebaseUser,
    @Param('songId') songId: string,
    @Body() body: { successUrl?: string; cancelUrl?: string },
  ) {
    const userId = await this.resolveUserId(user.uid);
    return this.paymentsService.createSongPurchaseCheckout(userId, songId, {
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });
  }

  /**
   * Stripe webhook handler for payment events.
   *
   * Events handled:
   * - payment_intent.succeeded: Mobile app payment completed
   * - payment_intent.payment_failed: Mobile app payment failed
   * - checkout.session.completed: Web app payment completed
   * - checkout.session.expired: Web app checkout session expired
   * - checkout.session.async_payment_succeeded: Async payment completed (e.g., bank transfers)
   * - checkout.session.async_payment_failed: Async payment failed
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody?.toString() || '';

    try {
      const event = await this.stripeService.verifyWebhookSignature(
        payload,
        signature,
      );

      switch (event.type) {
        // Mobile app flow - PaymentIntent events
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as { id: string };
          await this.paymentsService.handlePaymentSuccess(paymentIntent.id);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as { id: string };
          await this.paymentsService.handlePaymentFailed(paymentIntent.id);
          break;
        }

        // Web app flow - Checkout Session events
        case 'checkout.session.completed': {
          const session = event.data.object as {
            id: string;
            mode?: string;
            payment_status?: string;
            subscription?: string;
            client_reference_id?: string | null;
          };
          if (
            session.mode === 'subscription' &&
            session.subscription &&
            session.client_reference_id
          ) {
            const sub = await this.stripeService.getSubscription(
              session.subscription,
            );
            const priceId = sub.items?.data?.[0]?.price?.id ?? '';
            if (priceId === this.stripeService.getProNetworxPriceId()) {
              await this.paymentsService.handleProNetworxCheckoutCompleted(
                session.subscription,
                session.client_reference_id,
              );
            } else {
              await this.paymentsService.handleCreatorNetworkCheckoutCompleted(
                session.subscription,
                session.client_reference_id,
              );
            }
          } else if (session.payment_status === 'paid') {
            await this.paymentsService.handleCheckoutSessionCompleted(
              session.id,
            );
          }
          break;
        }

        case 'checkout.session.async_payment_succeeded': {
          const session = event.data.object as { id: string };
          await this.paymentsService.handleCheckoutSessionCompleted(session.id);
          break;
        }

        case 'checkout.session.async_payment_failed':
        case 'checkout.session.expired': {
          const session = event.data.object as { id: string };
          await this.paymentsService.handleCheckoutSessionFailed(session.id);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as {
            id: string;
            status: string;
            current_period_end?: number;
            customer?: string | { id: string };
            items?: { data?: Array<{ price?: { id?: string } }> };
          };
          const priceId =
            subscription.items?.data?.[0]?.price?.id ?? '';
          if (priceId === this.stripeService.getProNetworxPriceId()) {
            await this.paymentsService.handleProNetworxSubscriptionUpdated(
              subscription,
            );
          } else {
            await this.paymentsService.handleCreatorNetworkSubscriptionUpdated(
              subscription,
            );
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as {
            id: string;
            items?: { data?: Array<{ price?: { id?: string } }> };
          };
          const priceId =
            subscription.items?.data?.[0]?.price?.id ?? '';
          if (priceId === this.stripeService.getProNetworxPriceId()) {
            await this.paymentsService.handleProNetworxSubscriptionDeleted(
              subscription.id,
            );
          } else {
            await this.paymentsService.handleCreatorNetworkSubscriptionDeleted(
              subscription.id,
            );
          }
          break;
        }

        // Stripe Connect: artist onboarding/payout capability changed.
        case 'account.updated': {
          const account = event.data.object as {
            id: string;
            charges_enabled?: boolean;
            payouts_enabled?: boolean;
            details_submitted?: boolean;
          };
          await this.paymentsService.handleConnectAccountUpdated(account);
          break;
        }

        case 'setup_intent.succeeded': {
          const intent = event.data.object as {
            id: string;
            customer?: string | { id: string };
            metadata?: Record<string, string>;
          };
          if (intent.metadata?.productKey === 'pro_networx_subscription') {
            await this.paymentsService.handleProNetworxSetupIntentSucceeded(
              intent,
            );
          }
          break;
        }

        default:
          // Log unhandled events for debugging (but don't fail)
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return { received: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Webhook error: ${errorMessage}`);
    }
  }

  @Get('transactions')
  async getTransactions(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    return this.paymentsService.getTransactions(userData.id);
  }
}
