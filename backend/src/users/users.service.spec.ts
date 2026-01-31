import { UsersService } from './users.service';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

const createBuilder = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
});

describe('UsersService', () => {
  it('returns existing user if already present', async () => {
    const service = new UsersService();
    const usersBuilder = createBuilder();
    const supabase = {
      from: jest.fn(() => usersBuilder),
    };

    usersBuilder.single.mockResolvedValueOnce({
      data: {
        id: 'user-id',
        email: 'existing@example.com',
        display_name: 'Existing',
        role: 'listener',
        avatar_url: null,
        created_at: new Date().toISOString(),
        firebase_uid: 'firebase-uid',
      },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createUser('firebase-uid', {
      email: 'existing@example.com',
      displayName: 'Existing',
      role: 'listener',
    });

    expect(result.email).toBe('existing@example.com');
  });

  it('inserts new artist and initializes credits', async () => {
    const service = new UsersService();
    const usersBuilder = createBuilder();
    const creditsBuilder = createBuilder();
    creditsBuilder.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: jest.fn((table: string) => (table === 'credits' ? creditsBuilder : usersBuilder)),
    };

    usersBuilder.single
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'artist-id',
          email: 'artist@example.com',
          display_name: 'Artist',
          role: 'artist',
          avatar_url: null,
          created_at: new Date().toISOString(),
          firebase_uid: 'firebase-uid',
        },
        error: null,
      });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createUser('firebase-uid', {
      email: 'artist@example.com',
      displayName: 'Artist',
      role: 'artist',
    });

    expect(result.role).toBe('artist');
    expect(creditsBuilder.insert).toHaveBeenCalled();
  });
});
