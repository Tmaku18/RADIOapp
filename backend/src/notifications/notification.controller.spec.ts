import { NotificationController } from './notification.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('NotificationController', () => {
  it('returns unread count', async () => {
    const notificationService = {
      getForUser: jest.fn(),
      getUnreadCount: jest.fn().mockResolvedValue(3),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
      deleteAll: jest.fn(),
    };
    const controller = new NotificationController(notificationService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'user-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.getUnreadCount({ uid: 'firebase-uid' } as any);

    expect(notificationService.getUnreadCount).toHaveBeenCalledWith('user-id');
    expect(result).toEqual({ count: 3 });
  });

  it('marks a notification as read', async () => {
    const notificationService = {
      getForUser: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
      deleteAll: jest.fn(),
    };
    const controller = new NotificationController(notificationService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'user-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.markAsRead({ uid: 'firebase-uid' } as any, 'notif-1');

    expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-id');
    expect(result).toEqual({ success: true });
  });
});
