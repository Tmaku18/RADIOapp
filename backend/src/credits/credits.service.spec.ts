import { BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('CreditsService', () => {
  it('rejects non-positive allocations', async () => {
    const service = new CreditsService();
    await expect(service.allocateCreditsToSong('artist', 'song', 0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('allocates credits via RPC', async () => {
    const service = new CreditsService();
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: { success: true, balance_before: 10, balance_after: 5, song_credits: 5 },
        error: null,
      }),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.allocateCreditsToSong('artist', 'song', 5);
    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('allocate_credits', {
      p_artist_id: 'artist',
      p_song_id: 'song',
      p_amount: 5,
    });
  });
});
