import { AdminService } from './admin.service';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('AdminService', () => {
  it('fetches songs with default filters', async () => {
    const emailService = {
      sendSongApprovedEmail: jest.fn(),
      sendSongRejectedEmail: jest.fn(),
      sendAdminSongRejectedEmail: jest.fn(),
    };
    const radioService = { clearEmptyStationCache: jest.fn() };
    const pushNotificationService = {
      sendPushNotification: jest.fn().mockResolvedValue(true),
      notifyAdminsSongStatusChange: jest.fn().mockResolvedValue({ notified: 0 }),
    };
    const service = new AdminService(
      emailService as any,
      radioService as any,
      pushNotificationService as any,
    );

    const supabase = createSupabaseMock();
    supabase.__builder.__result = {
      data: [{ id: 'song-id', title: 'Test Song' }],
      error: null,
    };
    (supabase as any).rpc = jest.fn().mockResolvedValue({ data: [], error: null });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.getSongsPendingApproval({});
    expect(result[0].id).toBe('song-id');
  });
});
