import { AnalyticsController } from './analytics.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('AnalyticsController', () => {
  it('returns artist analytics for current user', async () => {
    const analyticsService = {
      getArtistAnalytics: jest.fn().mockResolvedValue({ totalPlays: 10 }),
      getSongAnalytics: jest.fn(),
      getPlatformStats: jest.fn(),
    };
    const controller = new AnalyticsController(analyticsService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({
      data: { id: 'artist-id' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.getMyAnalytics(
      { uid: 'firebase-uid' } as any,
      '7',
    );

    expect(analyticsService.getArtistAnalytics).toHaveBeenCalledWith(
      'artist-id',
      7,
      undefined,
    );
    expect(result).toEqual({ totalPlays: 10 });
  });

  it('returns lightweight artist summary for current user', async () => {
    const summary = {
      totalSongs: 4,
      totalListenCount: 120,
      earsReached: 85,
      totalLikes: 19,
    };
    const analyticsService = {
      getArtistAnalytics: jest.fn(),
      getArtistSummary: jest.fn().mockResolvedValue(summary),
      getSongAnalytics: jest.fn(),
      getPlatformStats: jest.fn(),
    };
    const controller = new AnalyticsController(analyticsService as any);

    const result = await controller.getMySummary({
      uid: 'firebase-uid',
      dbUserId: 'artist-id',
    } as any);

    expect(analyticsService.getArtistSummary).toHaveBeenCalledWith('artist-id');
    expect(result).toEqual(summary);
  });

  it('returns platform stats', async () => {
    const analyticsService = {
      getArtistAnalytics: jest.fn(),
      getSongAnalytics: jest.fn(),
      getPlatformStats: jest.fn().mockResolvedValue({ listeners: 100 }),
      getPlatformLiveStats: jest.fn(),
    };
    const controller = new AnalyticsController(analyticsService as any);

    const result = await controller.getPlatformStats();

    expect(analyticsService.getPlatformStats).toHaveBeenCalled();
    expect(result).toEqual({ listeners: 100 });
  });
});
