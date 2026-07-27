import { ProNetworkSubscriptionController } from './pro-network-subscription.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ProNetworkSubscriptionController', () => {
  it('returns access + pricing for current user', async () => {
    const sub = {
      getAccess: jest.fn().mockResolvedValue({
        hasAccess: false,
        status: 'none',
      }),
    };
    const controller = new ProNetworkSubscriptionController(sub as any);
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-1' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.access({ uid: 'firebase-1' } as any);

    expect(sub.getAccess).toHaveBeenCalledWith('user-1');
    expect(result.hasAccess).toBe(false);
    expect(result.pricing.regularCents).toBe(999);
    expect(result.pricing.introCents).toBe(499);
  });
});
