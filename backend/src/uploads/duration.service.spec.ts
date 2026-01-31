import { DurationService } from './duration.service';
import * as mm from 'music-metadata';

jest.mock(
  'music-metadata',
  () => ({
    parseBuffer: jest.fn(),
  }),
  { virtual: true },
);

describe('DurationService', () => {
  it('calculates credits for play', () => {
    const service = new DurationService();
    expect(service.calculateCreditsForPlay(5)).toBe(1);
    expect(service.calculateCreditsForPlay(7)).toBe(2);
  });

  it('extracts duration from metadata', async () => {
    (mm.parseBuffer as jest.Mock).mockResolvedValue({
      format: { duration: 180.2 },
    });

    const service = new DurationService();
    const duration = await service.extractDuration(Buffer.from('test'));

    expect(duration).toBe(181);
  });
});
