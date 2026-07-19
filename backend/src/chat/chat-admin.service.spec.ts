import { ChatAdminService } from './chat-admin.service';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ChatAdminService', () => {
  it('toggles chat state', async () => {
    const service = new ChatAdminService();
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { enabled: false, disabled_reason: 'maintenance' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.toggleChat(false, 'maintenance');
    expect(result.enabled).toBe(false);
  });
});
