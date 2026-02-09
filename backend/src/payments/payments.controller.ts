import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

    return this.paymentsService.createPaymentIntent(userData.id, dto);
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
    const successUrl = body.successUrl || `${webUrl}/profile?creator_network=success`;
    const cancelUrl = body.cancelUrl || `${webUrl}/profile?creator_network=canceled`;
    return this.paymentsService.createCreatorNetworkCheckoutSession(userData.id, successUrl, cancelUrl);
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
      const event = await this.stripeService.verifyWebhookSignature(payload, signature);

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
          if (session.mode === 'subscription' && session.subscription && session.client_reference_id) {
            await this.paymentsService.handleCreatorNetworkCheckoutCompleted(
              session.subscription,
              session.client_reference_id,
            );
          } else if (session.payment_status === 'paid') {
            await this.paymentsService.handleCheckoutSessionCompleted(session.id);
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
            items?: { data?: Array<{ price?: { id?: string } }> };
          };
          await this.paymentsService.handleCreatorNetworkSubscriptionUpdated(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as { id: string };
          await this.paymentsService.handleCreatorNetworkSubscriptionDeleted(subscription.id);
          break;
        }

        default:
          // Log unhandled events for debugging (but don't fail)
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return { received: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
