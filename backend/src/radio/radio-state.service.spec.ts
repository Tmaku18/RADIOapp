import { RadioStateService } from './radio-state.service';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';
import { isRedisAvailable } from '../config/redis.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../config/redis.config', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

describe('RadioStateService', () => {
  it('returns database state when Redis unavailable', async () => {
    const service = new RadioStateService();
    (isRedisAvailable as jest.Mock).mockResolvedValue(false);

    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: {
        song_id: 'song-id',
        started_at: new Date().toISOString(),
        duration_ms: 180000,
        priority_score: 0,
        is_fallback: false,
        is_admin_fallback: false,
        played_at: new Date().toISOString(),
      },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    await service.onModuleInit();
    const result = await service.getCurrentState();

    expect(result?.songId).toBe('song-id');
  });
});
