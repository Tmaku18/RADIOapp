import { BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('CreditsService', () => {
  it('rejects non-positive allocations', async () => {
    const service = new CreditsService();
    await expect(
      service.allocateCreditsToSong('artist', 'song', 0),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects allocate because the credit bank is retired', async () => {
    const service = new CreditsService();
    await expect(
      service.allocateCreditsToSong('artist', 'song', 5),
    ).rejects.toMatchObject({
      message:
        'Credits are no longer used. Buy placements for a song from My Songs.',
    });
  });

  it('rejects withdraw because the credit bank is retired', async () => {
    const service = new CreditsService();
    await expect(
      service.withdrawCreditsFromSong('artist', 'song', 5),
    ).rejects.toMatchObject({
      message:
        'Credits are no longer used. Buy placements for a song from My Songs.',
    });
  });

  it('reports balance as the sum of song placement budgets', async () => {
    const service = new CreditsService();
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'credits') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    balance: 99,
                    total_purchased: 10,
                    total_used: 3,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { credits_remaining: 1200 },
                { credits_remaining: 800 },
              ],
              error: null,
            }),
          }),
        };
      }),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.getArtistCredits('artist');
    expect(result.balance).toBe(2000);
    expect(result.placementBudget).toBe(2000);
    expect(result.totalPurchased).toBe(10);
    expect(result.totalUsed).toBe(3);
  });
});
