import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SongsService } from './songs.service';
import { CopyrightService } from '../copyright/copyright.service';
import { LyricsService } from '../lyrics/lyrics.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { EmailService } from '../email/email.service';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

const createBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
});

const createCopyrightServiceMock = () =>
  ({ queueCheck: jest.fn() }) as unknown as CopyrightService;

const createLyricsServiceMock = () =>
  ({
    upsertLyrics: jest.fn().mockResolvedValue({}),
    alignLyricsInBackground: jest.fn(),
    transcribeLyricsInBackground: jest.fn(),
  }) as unknown as LyricsService;

const createPushServiceMock = () =>
  ({
    notifyFollowersArtistNewUpload: jest.fn().mockResolvedValue({
      notified: 0,
      followers: 0,
    }),
    notifyAdminsNewSongUpload: jest.fn().mockResolvedValue({ notified: 0 }),
  }) as unknown as PushNotificationService;

const createEmailServiceMock = () =>
  ({
    sendAdminNewSongUploadEmail: jest.fn().mockResolvedValue(true),
  }) as unknown as EmailService;

const createProRadioSubMock = () =>
  ({
    getAccess: jest.fn().mockResolvedValue({ hasAccess: false, status: null }),
    hasNeverSubscribed: jest.fn().mockResolvedValue(true),
    setSubscription: jest.fn(),
  }) as unknown as import('../pro-radio-subscription/pro-radio-subscription.service').ProRadioSubscriptionService;

const createSongsService = (
  copyright = createCopyrightServiceMock(),
  lyrics = createLyricsServiceMock(),
  push = createPushServiceMock(),
  email = createEmailServiceMock(),
) => new SongsService(copyright, lyrics, push, email, createProRadioSubMock());

const baseSongDto = {
  title: 'Test Song',
  artistName: 'Test Artist',
  artistOriginCity: 'Atlanta',
  artistOriginState: 'GA',
  stationId: 'us-hip-hop',
  audioUrl: 'https://example.com/audio.mp3',
  artworkUrl: undefined as string | undefined,
  durationSeconds: 180,
  optInFullSongRadio: true,
};

describe('SongsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-artist uploads', async () => {
    const service = createSongsService();
    const usersBuilder = createBuilder();
    usersBuilder.single.mockResolvedValue({
      data: { role: 'listener' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => usersBuilder),
    });

    await expect(
      service.createSong('user-id', baseSongDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects uploads without full-song radio opt-in', async () => {
    const service = createSongsService();

    await expect(
      service.createSong('artist-id', {
        ...baseSongDto,
        optInFullSongRadio: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid discover clip trim range', async () => {
    const service = createSongsService();
    const usersBuilder = createBuilder();
    usersBuilder.single.mockResolvedValue({
      data: { role: 'artist' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => usersBuilder),
    });

    await expect(
      service.createSong('artist-id', {
        ...baseSongDto,
        discoverClipStartSeconds: 10,
        discoverClipEndSeconds: 40,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates song for artist', async () => {
    const lyrics = createLyricsServiceMock();
    const copyright = createCopyrightServiceMock();
    const service = createSongsService(copyright, lyrics);
    jest
      .spyOn(service, 'generateSampleInBackground')
      .mockImplementation(() => undefined);
    jest
      .spyOn(service, 'generateDiscoverClipInBackground')
      .mockImplementation(() => undefined);

    const usersBuilder = createBuilder();
    const songsBuilder = createBuilder();

    usersBuilder.single.mockResolvedValue({
      data: { role: 'artist' },
      error: null,
    });
    songsBuilder.single.mockResolvedValue({
      data: {
        id: 'song-id',
        title: 'Test Song',
        audio_url: baseSongDto.audioUrl,
        station_id: 'us-hip-hop',
        station_ids: ['us-hip-hop'],
      },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) =>
        table === 'users' ? usersBuilder : songsBuilder,
      ),
    });

    const result = await service.createSong('artist-id', {
      ...baseSongDto,
      sampleStartSeconds: 5,
      sampleEndSeconds: 25,
      discoverClipStartSeconds: 12,
      discoverClipEndSeconds: 22,
    });

    expect(result.title).toBe('Test Song');
    expect(copyright.queueCheck).toHaveBeenCalledWith(
      'song-id',
      baseSongDto.audioUrl,
    );
    expect(service.generateSampleInBackground).toHaveBeenCalledWith('song-id');
    expect(service.generateDiscoverClipInBackground).toHaveBeenCalledWith(
      'song-id',
    );
    expect(lyrics.transcribeLyricsInBackground).toHaveBeenCalledWith('song-id');
  });

  it('creates song for service_provider role', async () => {
    const service = createSongsService();
    jest
      .spyOn(service, 'generateSampleInBackground')
      .mockImplementation(() => undefined);

    const usersBuilder = createBuilder();
    const songsBuilder = createBuilder();
    usersBuilder.single.mockResolvedValue({
      data: { role: 'service_provider' },
      error: null,
    });
    songsBuilder.single.mockResolvedValue({
      data: { id: 'song-2', title: 'Test Song', audio_url: baseSongDto.audioUrl },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) =>
        table === 'users' ? usersBuilder : songsBuilder,
      ),
    });

    await expect(
      service.createSong('provider-id', baseSongDto),
    ).resolves.toMatchObject({ id: 'song-2' });
  });
});
