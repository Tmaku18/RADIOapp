import { CreditsController } from './credits.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('CreditsController', () => {
  it('returns artist balance', async () => {
    const creditsService = {
      getArtistCredits: jest.fn().mockResolvedValue({ balance: 10 }),
      getAllocationHistory: jest.fn(),
      allocateCreditsToSong: jest.fn(),
      withdrawCreditsFromSong: jest.fn(),
    };
    const controller = new CreditsController(creditsService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'artist-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.getBalance({ uid: 'firebase-uid' } as any);

    expect(creditsService.getArtistCredits).toHaveBeenCalledWith('artist-id');
    expect(result).toEqual({ balance: 10 });
  });

  it('allocates credits to a song', async () => {
    const creditsService = {
      getArtistCredits: jest.fn(),
      getAllocationHistory: jest.fn(),
      allocateCreditsToSong: jest.fn().mockResolvedValue({ success: true }),
      withdrawCreditsFromSong: jest.fn(),
    };
    const controller = new CreditsController(creditsService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'artist-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.allocateCredits(
      { uid: 'firebase-uid' } as any,
      'song-1',
      { amount: 5 } as any,
    );

    expect(creditsService.allocateCreditsToSong).toHaveBeenCalledWith('artist-id', 'song-1', 5);
    expect(result).toEqual({ success: true });
  });
});
