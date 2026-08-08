import { SongsController } from './songs.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('music-metadata', () => ({}), { virtual: true });

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../common/song-audio.util', () => ({
  signSongAudioUrl: jest.fn(async (url: string | null) => url),
}));

const createAdminServiceMock = () => ({}) as any;
const createAudioTranscodeMock = () =>
  ({
    needsStreamTranscode: jest.fn().mockReturnValue(false),
    transcodeToStreamMp3: jest.fn().mockResolvedValue(null),
  }) as any;
const createImageModerationMock = () =>
  ({
    checkImage: jest.fn(),
    assertImageUrlAllowed: jest.fn().mockResolvedValue(undefined),
    assertImageBufferAllowed: jest.fn().mockResolvedValue(undefined),
  }) as any;
const createLyricsServiceMock = () =>
  ({
    getLyrics: jest.fn(),
    upsertLyrics: jest.fn(),
    backfillMissingLyrics: jest.fn(),
    transcribeLyricsInBackground: jest.fn(),
  }) as any;

describe('SongsController', () => {
  it('delegates getSongs with parsed limits', async () => {
    const songsService = {
      getSongs: jest.fn().mockResolvedValue([{ id: 'song-1' }]),
      getSongById: jest.fn(),
      createSong: jest.fn(),
      getSongsByArtist: jest.fn(),
      updateSong: jest.fn(),
      isLiked: jest.fn(),
      toggleLike: jest.fn(),
      unlikeSong: jest.fn(),
    };
    const uploadsService = { getSignedUploadUrl: jest.fn() };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
      createAudioTranscodeMock(),
      createAdminServiceMock(),
      createImageModerationMock(),
      createLyricsServiceMock(),
      { backfillChecks: jest.fn() } as any,
    );

    await controller.getSongs('artist-1', 'approved', '10', '5');

    expect(songsService.getSongs).toHaveBeenCalledWith({
      artistId: 'artist-1',
      status: 'approved',
      limit: 10,
      offset: 5,
    });
  });

  it('returns upload url for current artist', async () => {
    const songsService = {
      getSongs: jest.fn(),
      createSong: jest.fn(),
      getSongById: jest.fn(),
    };
    const uploadsService = {
      getSignedUploadUrl: jest.fn().mockResolvedValue({
        signedUrl: 'signed-url',
        path: 'artist-id/track.mp3',
        expiresIn: 60,
      }),
    };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
      createAudioTranscodeMock(),
      createAdminServiceMock(),
      createImageModerationMock(),
      createLyricsServiceMock(),
      { backfillChecks: jest.fn() } as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.maybeSingle.mockResolvedValue({
      data: {
        id: 'artist-id',
        display_name: 'Artist',
        avatar_url: null,
      },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.getUploadUrl(
      { uid: 'firebase-uid' } as any,
      {
        bucket: 'songs',
        filename: 'track.mp3',
        contentType: 'audio/mpeg',
      } as any,
    );

    expect(uploadsService.getSignedUploadUrl).toHaveBeenCalledWith(
      'artist-id',
      'songs',
      'track.mp3',
      'audio/mpeg',
    );
    expect(result).toEqual({
      signedUrl: 'signed-url',
      path: 'artist-id/track.mp3',
      expiresIn: 60,
    });
  });

  it('creates song from storage paths', async () => {
    const songsService = {
      createSong: jest.fn().mockResolvedValue({ id: 'song-1' }),
      getSongs: jest.fn(),
      getSongById: jest.fn(),
    };
    const uploadsService = { getSignedUploadUrl: jest.fn() };
    const durationService = {
      extractDuration: jest.fn().mockResolvedValue(180),
    };
    const imageModeration = createImageModerationMock();
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
      createAudioTranscodeMock(),
      createAdminServiceMock(),
      imageModeration,
      createLyricsServiceMock(),
      { backfillChecks: jest.fn() } as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.maybeSingle.mockResolvedValue({
      data: {
        id: 'artist-id',
        display_name: 'Artist',
        avatar_url: null,
      },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.createSong(
      { uid: 'firebase-uid' } as any,
      {
        title: 'Track',
        artistOriginCity: 'Atlanta',
        artistOriginState: 'GA',
        stationId: 'us-hip-hop',
        audioPath: 'songs/track.mp3',
        artworkPath: 'artwork/cover.jpg',
        durationSeconds: 180,
        sampleStartSeconds: 5,
        sampleEndSeconds: 25,
        discoverClipStartSeconds: 10,
        discoverClipEndSeconds: 20,
        optInFullSongRadio: true,
      } as any,
    );

    expect(imageModeration.assertImageUrlAllowed).toHaveBeenCalled();
    expect(songsService.createSong).toHaveBeenCalledWith(
      'artist-id',
      expect.objectContaining({
        title: 'Track',
        artistName: 'Artist',
        artistOriginCity: 'Atlanta',
        artistOriginState: 'GA',
        audioUrl: 'https://example.com/file',
        artworkUrl: 'https://example.com/file',
        stationId: 'us-hip-hop',
        optInFullSongRadio: true,
        sampleStartSeconds: 5,
        sampleEndSeconds: 25,
        discoverClipStartSeconds: 10,
        discoverClipEndSeconds: 20,
      }),
    );
    expect(result).toEqual({ id: 'song-1' });
  });

  it('updates song settings for admin', async () => {
    const songsService = {
      createSong: jest.fn(),
      getSongs: jest.fn(),
      getSongById: jest.fn(),
    };
    const uploadsService = { getSignedUploadUrl: jest.fn() };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
      createAudioTranscodeMock(),
      createAdminServiceMock(),
      createImageModerationMock(),
      createLyricsServiceMock(),
      { backfillChecks: jest.fn() } as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.single
      .mockResolvedValueOnce({
        data: { id: 'admin-id', role: 'admin' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { artist_id: 'artist-id' }, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'song-1',
          title: 'Track',
          opt_in_free_play: true,
          opt_in_full_song_radio: true,
          opt_in_dj_livestreams: false,
          opt_in_dj_archived_mixes: false,
          artwork_url: null,
          station_id: 'us-hip-hop',
          station_ids: ['us-hip-hop'],
          discover_enabled: false,
          discover_clip_url: null,
          discover_background_url: null,
          discover_clip_start_seconds: null,
          discover_clip_end_seconds: null,
          discover_clip_duration_seconds: null,
          is_explicit: true,
        },
        error: null,
      });
    supabase.__builder.__result = { data: [], error: null };
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.updateSong(
      { uid: 'firebase-uid' } as any,
      'song-1',
      { optInFreePlay: true },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'song-1',
        title: 'Track',
        optInFreePlay: true,
      }),
    );
  });
});
