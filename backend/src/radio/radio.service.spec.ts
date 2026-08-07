import { RadioService } from './radio.service';

describe('RadioService', () => {
  const createService = (overrides: { stateService?: any } = {}) =>
    new RadioService(
      {} as any,
      {} as any,
      {
        getCurrentState: jest.fn(),
        setCurrentState: jest.fn(),
        logPlayDecision: jest.fn(),
        getLastAdvanceAt: jest.fn().mockResolvedValue(0),
        setLastAdvanceAt: jest.fn().mockResolvedValue(undefined),
        ...(overrides.stateService ?? {}),
      } as any,
      { broadcast: jest.fn().mockResolvedValue(undefined) } as any,
    );

  it('calculates credits required per play', () => {
    const service = createService() as any;
    expect(service.calculateCreditsRequired(5)).toBe(1);
    expect(service.calculateCreditsRequired(7)).toBe(1);
    expect(service.calculateCreditsRequired(180)).toBe(1);
  });

  it('builds no_content response', () => {
    const service = createService() as any;
    const result = service.buildNoContentResponse();
    expect(result.no_content).toBe(true);
    expect(result.audio_url).toBeNull();
  });

  describe('force advance guard', () => {
    const state = (songId: string) => ({
      songId,
      startedAt: Date.now(),
      durationMs: 180_000,
      priorityScore: 0,
      isFallback: false,
      isAdminFallback: false,
      playedAt: new Date().toISOString(),
    });

    it('advances for the device that finished the current song', async () => {
      const service = createService() as any;
      await expect(
        service.shouldHonourForceAdvance(
          'us-rap',
          state('song-a'),
          'song-a',
          Date.now(),
        ),
      ).resolves.toBe(true);
    });

    it('ignores a device that already fell a song behind', async () => {
      const service = createService() as any;
      // The queue moved to song-b, so this nudge would skip song-b entirely.
      await expect(
        service.shouldHonourForceAdvance(
          'us-rap',
          state('song-b'),
          'song-a',
          Date.now(),
        ),
      ).resolves.toBe(false);
    });

    it('matches on the bare id when state carries a prefix', async () => {
      const service = createService() as any;
      await expect(
        service.shouldHonourForceAdvance(
          'us-rap',
          state('admin:song-a'),
          'song-a',
          Date.now(),
        ),
      ).resolves.toBe(true);
    });

    it('falls back to the time debounce for clients sending no song id', async () => {
      const now = Date.now();
      const service = createService({
        stateService: {
          getLastAdvanceAt: jest.fn().mockResolvedValue(now - 1000),
        },
      }) as any;
      await expect(
        service.shouldHonourForceAdvance('us-rap', state('song-b'), null, now),
      ).resolves.toBe(false);
    });

    it('allows an old client through once the debounce window passes', async () => {
      const now = Date.now();
      const service = createService({
        stateService: {
          getLastAdvanceAt: jest.fn().mockResolvedValue(now - 60_000),
        },
      }) as any;
      await expect(
        service.shouldHonourForceAdvance('us-rap', state('song-b'), null, now),
      ).resolves.toBe(true);
    });
  });

  describe('station scheduler', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('arms one timer per station, newest schedule winning', () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.scheduleStationAdvance('us-rap', 60_000);
      service.scheduleStationAdvance('us-rap', 30_000);
      expect(service.stationTimers.size).toBe(1);
      expect(jest.getTimerCount()).toBe(1);
    });

    it('advances a station with no listeners when its song ends', async () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.getQueueState = jest.fn().mockResolvedValue({
        songId: 'song-a',
        startedAt: Date.now() - 180_000,
        durationMs: 180_000,
      });
      service.getNextTrack = jest
        .fn()
        .mockResolvedValue({ id: 'song-b', duration_seconds: 200 });

      await service.runStationTick('us-rap');

      expect(service.getNextTrack).toHaveBeenCalledWith('us-rap');
      // Re-armed for the new song's boundary.
      expect(service.stationTimers.has('us-rap')).toBe(true);
    });

    it('re-arms without advancing when the song is still playing', async () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.getQueueState = jest.fn().mockResolvedValue({
        songId: 'song-a',
        startedAt: Date.now() - 10_000,
        durationMs: 180_000,
      });
      service.getNextTrack = jest.fn();

      await service.runStationTick('us-rap');

      expect(service.getNextTrack).not.toHaveBeenCalled();
      expect(service.stationTimers.has('us-rap')).toBe(true);
    });

    it('backs off an empty station instead of retrying in a loop', async () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.getQueueState = jest.fn().mockResolvedValue(null);
      service.getNextTrack = jest.fn().mockResolvedValue({ no_content: true });

      await service.runStationTick('us-podcasts');

      expect(service.emptyStations.has('us-podcasts')).toBe(true);
      expect(service.stationTimers.has('us-podcasts')).toBe(true);
    });

    it('tells listeners to resync when a new song goes live, after the outro grace window', () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.onStationSongStarted('us-rap', 180);

      // Not immediately — listeners run a few seconds behind the server clock,
      // and an instant push would cut every outro ("falling out of sync").
      expect(service.stationRealtime.broadcast).not.toHaveBeenCalled();

      jest.advanceTimersByTime(8_000);
      expect(service.stationRealtime.broadcast).toHaveBeenCalledWith('us-rap', {
        type: 'queue_updated',
      });
    });

    it('supersedes a pending resync push when the station rotates again', () => {
      jest.useFakeTimers();
      const service = createService() as any;
      service.onStationSongStarted('us-rap', 180);
      jest.advanceTimersByTime(4_000);
      service.onStationSongStarted('us-rap', 200);
      jest.advanceTimersByTime(8_000);

      expect(service.stationRealtime.broadcast).toHaveBeenCalledTimes(1);
    });
  });
});
