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

const mockUploadsService = { uploadProfileImage: jest.fn() };
const mockConfigService = { get: jest.fn().mockReturnValue(undefined) };

describe('UsersService', () => {
  it('returns existing user if already present', async () => {
    const service = new UsersService(mockUploadsService as any, mockConfigService as any);
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

  it('inserts new artist (credits created by DB trigger)', async () => {
    const service = new UsersService(mockUploadsService as any, mockConfigService as any);
    const usersBuilder = createBuilder();
    const insertChain = { ...createBuilder(), select: jest.fn().mockReturnThis(), single: jest.fn() };
    (insertChain as any).single.mockResolvedValueOnce({
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

    const supabase = { from: jest.fn(() => usersBuilder) };

    usersBuilder.single.mockResolvedValueOnce({ data: null, error: null });
    usersBuilder.insert.mockReturnValue(insertChain);

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createUser('firebase-uid', {
      email: 'artist@example.com',
      displayName: 'Artist',
      role: 'artist',
    });

    expect(result.role).toBe('artist');
    expect(usersBuilder.insert).toHaveBeenCalled();
  });

  it('assigns admin role when email is in ADMIN_EMAILS', async () => {
    const configWithAdmin = { get: jest.fn((key: string) => (key === 'ADMIN_EMAILS' ? 'admin@example.com, other@example.com ' : undefined)) };
    const service = new UsersService(mockUploadsService as any, configWithAdmin as any);
    const usersBuilder = createBuilder();
    const insertChain = { ...createBuilder(), select: jest.fn().mockReturnThis(), single: jest.fn() };
    (insertChain as any).single.mockResolvedValueOnce({
      data: {
        id: 'admin-id',
        email: 'admin@example.com',
        display_name: 'Admin',
        role: 'admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        firebase_uid: 'firebase-uid',
      },
      error: null,
    });

    const supabase = { from: jest.fn(() => usersBuilder) };
    usersBuilder.single.mockResolvedValueOnce({ data: null, error: null });
    usersBuilder.insert.mockReturnValue(insertChain);
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await service.createUser('firebase-uid', {
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'listener',
    });

    expect(result.role).toBe('admin');
    expect(usersBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'admin',
      }),
    );
  });
});
