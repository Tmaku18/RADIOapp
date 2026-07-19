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
    };
    const service = new AdminService(emailService as any);

    const supabase = createSupabaseMock();
    supabase.__builder.__result = {
      data: [{ id: 'song-id', title: 'Test Song' }],
      error: null,
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.getSongsPendingApproval({});
    expect(result[0].id).toBe('song-id');
  });
});
