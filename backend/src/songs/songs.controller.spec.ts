import { SongsController } from './songs.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('music-metadata', () => ({}), { virtual: true });

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

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
    const songsService = { getSongs: jest.fn(), createSong: jest.fn(), getSongById: jest.fn() };
    const uploadsService = {
      getSignedUploadUrl: jest.fn().mockResolvedValue({ url: 'signed-url' }),
    };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'artist-id' }, error: null });
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
    expect(result).toEqual({ url: 'signed-url' });
  });

  it('creates song from storage paths', async () => {
    const songsService = {
      createSong: jest.fn().mockResolvedValue({ id: 'song-1' }),
      getSongs: jest.fn(),
      getSongById: jest.fn(),
    };
    const uploadsService = { getSignedUploadUrl: jest.fn() };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'artist-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.createSong(
      { uid: 'firebase-uid' } as any,
      {
        title: 'Track',
        artistName: 'Artist',
        audioPath: 'songs/track.mp3',
        artworkPath: 'artwork/cover.jpg',
        durationSeconds: 180,
      } as any,
    );

    expect(songsService.createSong).toHaveBeenCalledWith('artist-id', {
      title: 'Track',
      artistName: 'Artist',
      audioUrl: 'https://example.com/file',
      artworkUrl: 'https://example.com/file',
      durationSeconds: 180,
    });
    expect(result).toEqual({ id: 'song-1' });
  });

  it('updates song settings for admin', async () => {
    const songsService = { createSong: jest.fn(), getSongs: jest.fn(), getSongById: jest.fn() };
    const uploadsService = { getSignedUploadUrl: jest.fn() };
    const durationService = { extractDuration: jest.fn() };
    const controller = new SongsController(
      songsService as any,
      uploadsService as any,
      durationService as any,
    );
    const supabase = createSupabaseMock();

    supabase.__builder.single
      .mockResolvedValueOnce({ data: { id: 'admin-id', role: 'admin' }, error: null })
      .mockResolvedValueOnce({ data: { artist_id: 'artist-id' }, error: null })
      .mockResolvedValueOnce({
        data: { id: 'song-1', title: 'Track', opt_in_free_play: true },
        error: null,
      });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.updateSong(
      { uid: 'firebase-uid' } as any,
      'song-1',
      { optInFreePlay: true },
    );

    expect(result).toEqual({ id: 'song-1', title: 'Track', optInFreePlay: true });
  });
});
