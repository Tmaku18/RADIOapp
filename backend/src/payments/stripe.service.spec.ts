import { StripeService } from './stripe.service';

jest.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
  const StripeMock = jest.fn(() => mockStripe);
  (StripeMock as any).__mockStripe = mockStripe;
  return {
    __esModule: true,
    default: StripeMock,
  };
});

const Stripe = jest.requireMock('stripe').default as jest.Mock;
const mockStripe = (Stripe as any).__mockStripe as any;

describe('StripeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when STRIPE_SECRET_KEY is missing', () => {
    const configService = { get: jest.fn().mockReturnValue(undefined) };
    expect(() => new StripeService(configService as any)).toThrow(
      'STRIPE_SECRET_KEY is not configured',
    );
  });

  it('creates payment intent', async () => {
    mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1' });
    const configService = { get: jest.fn().mockReturnValue('sk_test') };
    const service = new StripeService(configService as any);

    await service.createPaymentIntent(500, { userId: 'user-1' });

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
      amount: 500,
      currency: 'usd',
      metadata: { userId: 'user-1' },
    });
  });

  it('verifies webhook signature', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'checkout.session.completed' });
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        return undefined;
      }),
    };
    const service = new StripeService(configService as any);

    const event = await service.verifyWebhookSignature('payload', 'sig');

    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
      'payload',
      'sig',
      'whsec_test',
    );
    expect(event).toEqual({ type: 'checkout.session.completed' });
  });

  it('creates checkout session', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1' });
    const configService = { get: jest.fn().mockReturnValue('sk_test') };
    const service = new StripeService(configService as any);

    await service.createCheckoutSession(
      500,
      25,
      { userId: 'user-1' },
      'https://success.example.com',
      'https://cancel.example.com',
    );

    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: { userId: 'user-1' },
        success_url: 'https://success.example.com',
        cancel_url: 'https://cancel.example.com',
      }),
    );
  });
});
