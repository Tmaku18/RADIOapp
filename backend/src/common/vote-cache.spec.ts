import { RadioService } from '../radio/radio.service';
import { markVotesChanged, votesChangedSince } from './vote-cache';

describe('vote cache', () => {
  it('flags a song only after its votes change', () => {
    const before = Date.now();
    expect(votesChangedSince('song-never-voted', before)).toBe(false);
    markVotesChanged('song-voted');
    expect(votesChangedSince('song-voted', before)).toBe(true);
    expect(votesChangedSince('song-voted', Date.now() + 1000)).toBe(false);
  });

  it('recomputes a cached temperature once a vote lands', async () => {
    const service = new RadioService(
      {} as any,
      {} as any,
      {} as any,
      { broadcast: jest.fn() } as any,
    ) as any;
    const uncached = jest
      .fn()
      .mockResolvedValueOnce({ fireVotes: 1, temperaturePercent: 51 })
      .mockResolvedValueOnce({ fireVotes: 2, temperaturePercent: 52 });
    service.getSongTemperatureUncached = uncached;

    const args = { songId: 'song-a', playId: 'play-1' };
    expect((await service.getSongTemperature(args)).fireVotes).toBe(1);
    // Still cached: no second read.
    expect((await service.getSongTemperature(args)).fireVotes).toBe(1);
    expect(uncached).toHaveBeenCalledTimes(1);

    markVotesChanged('song-a');
    expect((await service.getSongTemperature(args)).fireVotes).toBe(2);
    expect(uncached).toHaveBeenCalledTimes(2);
  });
});
