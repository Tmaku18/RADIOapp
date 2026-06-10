import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('is defined', () => {
    const radioStateService = {
      getListenerCount: jest.fn().mockResolvedValue(0),
    };
    expect(new AnalyticsService(radioStateService as any)).toBeDefined();
  });
});
