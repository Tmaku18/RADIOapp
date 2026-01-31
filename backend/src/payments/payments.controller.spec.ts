import { PaymentsController } from './payments.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('PaymentsController', () => {
  it('creates payment intent for current user', async () => {
    const paymentsService = {
      createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'secret' }),
    };
    const stripeService = { verifyWebhookSignature: jest.fn() };
    const controller = new PaymentsController(paymentsService as any, stripeService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'user-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.createPaymentIntent(
      { uid: 'firebase-uid' } as any,
      { amount: 500, credits: 25 } as any,
    );

    expect(paymentsService.createPaymentIntent).toHaveBeenCalledWith('user-id', {
      amount: 500,
      credits: 25,
    });
    expect(result).toEqual({ clientSecret: 'secret' });
  });

  it('handles payment_intent.succeeded webhook', async () => {
    const paymentsService = {
      handlePaymentSuccess: jest.fn().mockResolvedValue(undefined),
      handlePaymentFailed: jest.fn(),
      handleCheckoutSessionCompleted: jest.fn(),
      handleCheckoutSessionFailed: jest.fn(),
      createPaymentIntent: jest.fn(),
      createCheckoutSession: jest.fn(),
      getTransactions: jest.fn(),
    };
    const stripeService = {
      verifyWebhookSignature: jest.fn().mockResolvedValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      }),
    };
    const controller = new PaymentsController(paymentsService as any, stripeService as any);

    const result = await controller.handleWebhook(
      { rawBody: Buffer.from('payload') } as any,
      'sig',
    );

    expect(paymentsService.handlePaymentSuccess).toHaveBeenCalledWith('pi_1');
    expect(result).toEqual({ received: true });
  });
});
