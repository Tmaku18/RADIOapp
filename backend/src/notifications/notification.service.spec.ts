import { NotificationService } from './notification.service';
import { getSupabaseClient } from '../config/supabase.config';
import { createSupabaseMock } from '../test-utils/supabase-mock';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('NotificationService', () => {
  it('creates a notification', async () => {
    const service = new NotificationService();
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({
      data: { id: 'notification-id', title: 'Test' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.create({
      userId: 'user-id',
      type: 'info',
      title: 'Test',
      message: 'Hello',
    });

    expect(result.id).toBe('notification-id');
  });

  it('returns 0 unread when count missing', async () => {
    const service = new NotificationService();
    const supabase = createSupabaseMock();
    supabase.__builder.is.mockResolvedValue({ count: null, error: null });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const count = await service.getUnreadCount('user-id');
    expect(count).toBe(0);
  });
});
