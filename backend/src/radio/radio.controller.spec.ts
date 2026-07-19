import { RadioController } from './radio.controller';

describe('RadioController', () => {
  it('returns current track', async () => {
    const radioService = {
      getCurrentTrack: jest.fn().mockResolvedValue({ id: 'song-1' }),
      getNextTrack: jest.fn(),
      reportPlay: jest.fn(),
      getUpcomingQueue: jest.fn(),
      clearQueueState: jest.fn(),
    };
    const controller = new RadioController(radioService as any);

    const result = await controller.getCurrentTrack();

    expect(radioService.getCurrentTrack).toHaveBeenCalled();
    expect(result).toEqual({ id: 'song-1' });
  });

  it('reports play with default skip false', async () => {
    const radioService = {
      getCurrentTrack: jest.fn(),
      getNextTrack: jest.fn(),
      reportPlay: jest.fn().mockResolvedValue(undefined),
      getUpcomingQueue: jest.fn(),
      clearQueueState: jest.fn(),
    };
    const controller = new RadioController(radioService as any);

    const result = await controller.reportPlay({ songId: 'song-1' });

    expect(radioService.reportPlay).toHaveBeenCalledWith('song-1', false);
    expect(result).toEqual({ success: true });
  });
});
