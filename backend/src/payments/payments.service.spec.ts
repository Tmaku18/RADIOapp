import { PaymentsService } from './payments.service';
import { getSupabaseClient } from '../config/supabase.config';
import { createSupabaseMock } from '../test-utils/supabase-mock';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('PaymentsService', () => {
  it('creates payment intent and returns client secret', async () => {
    const stripeService = {
      createPaymentIntent: jest.fn().mockResolvedValue({
        id: 'pi_test',
        client_secret: 'secret',
      }),
    };
    const configService = { get: jest.fn() };
    const creatorNetwork = {};
    const proNetworkSub = {};
    const proRadioSub = {
      getAccess: jest.fn(),
      hasNeverSubscribed: jest.fn(),
      setSubscription: jest.fn(),
    };
    const googlePlayBillingService = {};
    const appStoreBillingService = {};
    const refineryService = {};

    const service = new PaymentsService(
      stripeService as any,
      configService as any,
      creatorNetwork as any,
      proNetworkSub as any,
      proRadioSub as any,
      googlePlayBillingService as any,
      appStoreBillingService as any,
      refineryService as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({
      data: { id: 'tx-1' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createPaymentIntent('user-id', {
      amount: 500,
      credits: 25,
    });

    expect(result.clientSecret).toBe('secret');
    expect(stripeService.createPaymentIntent).toHaveBeenCalled();
  });
});
