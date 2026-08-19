import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  it('rejects credit-package payment intents', async () => {
    const stripeService = {
      createPaymentIntent: jest.fn(),
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

    await expect(
      service.createPaymentIntent('user-id', {
        amount: 500,
        credits: 25,
      }),
    ).rejects.toMatchObject({
      message:
        'Credit packages are no longer sold. Buy placements for a song from My Songs.',
    });
    expect(stripeService.createPaymentIntent).not.toHaveBeenCalled();
  });
});
