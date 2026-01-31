import { ForbiddenException } from '@nestjs/common';
import { SongsService } from './songs.service';
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

describe('SongsService', () => {
  it('rejects non-artist uploads', async () => {
    const service = new SongsService();
    const usersBuilder = createBuilder();
    usersBuilder.single.mockResolvedValue({ data: { role: 'listener' }, error: null });

    const supabase = {
      from: jest.fn(() => usersBuilder),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    await expect(
      service.createSong('user-id', {
        title: 'Test Song',
        artistName: 'Test Artist',
        audioUrl: 'https://example.com/audio.mp3',
        artworkUrl: null,
        durationSeconds: 180,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates song for artist', async () => {
    const service = new SongsService();
    const usersBuilder = createBuilder();
    const songsBuilder = createBuilder();

    usersBuilder.single.mockResolvedValue({ data: { role: 'artist' }, error: null });
    songsBuilder.single.mockResolvedValue({
      data: { id: 'song-id', title: 'Test Song' },
      error: null,
    });

    const supabase = {
      from: jest.fn((table: string) => (table === 'users' ? usersBuilder : songsBuilder)),
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createSong('artist-id', {
      title: 'Test Song',
      artistName: 'Test Artist',
      audioUrl: 'https://example.com/audio.mp3',
      artworkUrl: null,
      durationSeconds: 180,
    });

    expect(result.title).toBe('Test Song');
  });
});
