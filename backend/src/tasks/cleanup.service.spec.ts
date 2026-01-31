import { CleanupService } from './cleanup.service';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('CleanupService', () => {
  it('handles archive RPC errors gracefully', async () => {
    const service = new CleanupService();
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'rpc error' } }),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    await expect(service.archiveOldChatMessages()).resolves.toBeUndefined();
  });
});
