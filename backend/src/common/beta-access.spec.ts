import { isBetaAllFree } from './beta-access';
import { ProRadioSubscriptionService } from '../pro-radio-subscription/pro-radio-subscription.service';
import { ProNetworkSubscriptionService } from '../pro-network-subscription/pro-network-subscription.service';
import { CreatorNetworkService } from '../creator-network/creator-network.service';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

describe('beta all-free access', () => {
  const original = process.env.BETA_ALL_FREE;
  const originalMessaging = process.env.PRO_NETWORX_MESSAGING_BETA_FREE;

  afterEach(() => {
    if (original === undefined) delete process.env.BETA_ALL_FREE;
    else process.env.BETA_ALL_FREE = original;
    if (originalMessaging === undefined) {
      delete process.env.PRO_NETWORX_MESSAGING_BETA_FREE;
    } else {
      process.env.PRO_NETWORX_MESSAGING_BETA_FREE = originalMessaging;
    }
  });

  it('defaults to free while the product is in beta', () => {
    delete process.env.BETA_ALL_FREE;
    expect(isBetaAllFree()).toBe(true);
  });

  it('can be switched off when beta ends', () => {
    process.env.BETA_ALL_FREE = 'false';
    expect(isBetaAllFree()).toBe(false);
  });

  it('grants Pro-Radio without a subscription row', async () => {
    process.env.BETA_ALL_FREE = 'true';
    const access = await new ProRadioSubscriptionService().getAccess('user-1');
    expect(access.hasAccess).toBe(true);
    expect(access.betaFree).toBe(true);
    // Status stays null so the manage-subscription UI doesn't claim they paid.
    expect(access.status).toBeNull();
  });

  it('withholds Pro-Radio once beta is off', async () => {
    process.env.BETA_ALL_FREE = 'false';
    const access = await new ProRadioSubscriptionService().getAccess('user-1');
    expect(access.hasAccess).toBe(false);
    expect(access.betaFree).toBe(false);
  });

  it('grants full Pro-Networx access, not just messaging', async () => {
    process.env.BETA_ALL_FREE = 'true';
    const access = await new ProNetworkSubscriptionService().getAccess('user-1');
    expect(access.hasAccess).toBe(true);
    expect(access.canMessage).toBe(true);
  });

  it('leaves Pro-Networx paid features gated with beta off', async () => {
    process.env.BETA_ALL_FREE = 'false';
    process.env.PRO_NETWORX_MESSAGING_BETA_FREE = 'false';
    const access = await new ProNetworkSubscriptionService().getAccess('user-1');
    expect(access.hasAccess).toBe(false);
    expect(access.canMessage).toBe(false);
  });

  it('grants Creator Network during beta', async () => {
    process.env.BETA_ALL_FREE = 'true';
    await expect(
      new CreatorNetworkService().hasCreatorNetworkAccess('user-1'),
    ).resolves.toBe(true);
  });

  it('withholds Creator Network once beta is off', async () => {
    process.env.BETA_ALL_FREE = 'false';
    await expect(
      new CreatorNetworkService().hasCreatorNetworkAccess('user-1'),
    ).resolves.toBe(false);
  });
});
