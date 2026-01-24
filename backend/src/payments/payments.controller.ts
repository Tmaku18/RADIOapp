import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

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

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody?.toString() || '';
    
    try {
      const event = await this.stripeService.verifyWebhookSignature(payload, signature);

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as { id: string };
        await this.paymentsService.handlePaymentSuccess(paymentIntent.id);
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
