import { ChatService } from './chat.service';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ChatService', () => {
  it('returns chat status', async () => {
    const service = new ChatService();
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { enabled: true, disabled_reason: null },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.getChatStatus();
    expect(result.enabled).toBe(true);
  });
});
