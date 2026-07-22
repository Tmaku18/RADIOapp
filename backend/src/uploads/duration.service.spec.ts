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

  it('returns null when video duration cannot be parsed', async () => {
    (mm.parseBuffer as jest.Mock).mockRejectedValue(new Error('no parser'));

    const service = new DurationService();
    await expect(
      service.extractDurationOrNull(Buffer.from('test'), 'video/mp4'),
    ).resolves.toBeNull();
  });

  it('falls back to 180 for song path when duration is unknown', async () => {
    (mm.parseBuffer as jest.Mock).mockRejectedValue(new Error('no parser'));

    const service = new DurationService();
    await expect(service.extractDuration(Buffer.from('test'))).resolves.toBe(
      180,
    );
  });
});
