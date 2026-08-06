import { isProNetworxMessagingBetaFree } from './pro-network-subscription.constants';
import { ProNetworkSubscriptionService } from './pro-network-subscription.service';

describe('Pro-Networx messaging beta free', () => {
  const original = process.env.PRO_NETWORX_MESSAGING_BETA_FREE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PRO_NETWORX_MESSAGING_BETA_FREE;
    } else {
      process.env.PRO_NETWORX_MESSAGING_BETA_FREE = original;
    }
  });

  it('defaults to free when the env var is unset', () => {
    delete process.env.PRO_NETWORX_MESSAGING_BETA_FREE;
    expect(isProNetworxMessagingBetaFree()).toBe(true);
  });

  it('can be turned off for post-beta paid messaging', () => {
    process.env.PRO_NETWORX_MESSAGING_BETA_FREE = 'false';
    expect(isProNetworxMessagingBetaFree()).toBe(false);
  });

  it('canSendMessages is true during beta without a subscription', async () => {
    process.env.PRO_NETWORX_MESSAGING_BETA_FREE = 'true';
    const service = new ProNetworkSubscriptionService();
    await expect(service.canSendMessages('any-user')).resolves.toBe(true);
  });
});
