import { RadioController } from './radio.controller';

describe('RadioController', () => {
  it('returns current track', async () => {
    const radioService = {
      getCachedCurrentTrack: jest.fn().mockReturnValue(null),
      getVerifiedCachedCurrentTrack: jest.fn().mockResolvedValue(null),
      getCurrentTrackCoalesced: jest.fn().mockResolvedValue({ id: 'song-1' }),
      getCurrentTrack: jest.fn(),
      getNextTrack: jest.fn(),
      reportPlay: jest.fn(),
      getUpcomingQueue: jest.fn(),
      clearQueueState: jest.fn(),
    };
    const controller = new RadioController(radioService as any, {} as any);

    const result = await controller.getCurrentTrack();

    expect(radioService.getCurrentTrackCoalesced).toHaveBeenCalled();
    expect(result).toEqual({ id: 'song-1' });
  });

  it('does not serve a snapshot the live queue has moved past', async () => {
    const radioService = {
      // Verification rejected the snapshot, so the poll must fall through to a
      // real read instead of replaying the song that just finished.
      getVerifiedCachedCurrentTrack: jest.fn().mockResolvedValue(null),
      getCachedCurrentTrack: jest.fn().mockReturnValue({ id: 'song-a' }),
      getCurrentTrackCoalesced: jest.fn().mockResolvedValue({ id: 'song-b' }),
      getCurrentTrack: jest.fn(),
      getNextTrack: jest.fn(),
      reportPlay: jest.fn(),
      getUpcomingQueue: jest.fn(),
      clearQueueState: jest.fn(),
    };
    const controller = new RadioController(radioService as any, {} as any);

    const result = await controller.getCurrentTrack('us-rap');

    expect(result).toEqual({ id: 'song-b' });
  });

  it('reports play with default skip false', async () => {
    const radioService = {
      getCachedCurrentTrack: jest.fn(),
      getCurrentTrackCoalesced: jest.fn(),
      getCurrentTrack: jest.fn(),
      getNextTrack: jest.fn(),
      reportPlay: jest.fn().mockResolvedValue(undefined),
      getUpcomingQueue: jest.fn(),
      clearQueueState: jest.fn(),
    };
    const controller = new RadioController(radioService as any, {} as any);

    const result = await controller.reportPlay({ songId: 'song-1' });

    expect(radioService.reportPlay).toHaveBeenCalledWith('song-1', false);
    expect(result).toEqual({ success: true });
  });
});
