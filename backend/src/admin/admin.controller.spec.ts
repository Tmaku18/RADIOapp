import { AdminController } from './admin.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('AdminController', () => {
  it('returns songs with total count', async () => {
    const adminService = {
      getSongsPendingApproval: jest.fn().mockResolvedValue([{ id: 'song-1' }]),
      updateSongStatus: jest.fn(),
      getAnalytics: jest.fn(),
      getAllUsers: jest.fn(),
      updateUserRole: jest.fn(),
      getFallbackSongs: jest.fn(),
      addFallbackSong: jest.fn(),
      updateFallbackSong: jest.fn(),
      deleteFallbackSong: jest.fn(),
      getBannedUsers: jest.fn(),
      hardBanUser: jest.fn(),
      shadowBanUser: jest.fn(),
      restoreUser: jest.fn(),
      searchSongsForFreeRotation: jest.fn(),
      searchUsersForFreeRotation: jest.fn(),
      getUserSongsForFreeRotation: jest.fn(),
      toggleFreeRotation: jest.fn(),
      getSongsInFreeRotation: jest.fn(),
    };
    const controller = new AdminController(adminService as any);

    const result = await controller.getSongs('pending', 'test', 'created_at', 'desc', '10', '0');

    expect(adminService.getSongsPendingApproval).toHaveBeenCalledWith({
      status: 'pending',
      search: 'test',
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit: 10,
      offset: 0,
    });
    expect(result).toEqual({ songs: [{ id: 'song-1' }], total: 1 });
  });

  it('updates song status with admin id', async () => {
    const adminService = {
      getSongsPendingApproval: jest.fn(),
      updateSongStatus: jest.fn().mockResolvedValue({ id: 'song-1' }),
      getAnalytics: jest.fn(),
      getAllUsers: jest.fn(),
      updateUserRole: jest.fn(),
      getFallbackSongs: jest.fn(),
      addFallbackSong: jest.fn(),
      updateFallbackSong: jest.fn(),
      deleteFallbackSong: jest.fn(),
      getBannedUsers: jest.fn(),
      hardBanUser: jest.fn(),
      shadowBanUser: jest.fn(),
      restoreUser: jest.fn(),
      searchSongsForFreeRotation: jest.fn(),
      searchUsersForFreeRotation: jest.fn(),
      getUserSongsForFreeRotation: jest.fn(),
      toggleFreeRotation: jest.fn(),
      getSongsInFreeRotation: jest.fn(),
    };
    const controller = new AdminController(adminService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'admin-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.updateSongStatus(
      { uid: 'firebase-uid' } as any,
      'song-1',
      { status: 'approved', reason: 'ok' } as any,
    );

    expect(adminService.updateSongStatus).toHaveBeenCalledWith(
      'song-1',
      'approved',
      'ok',
      'admin-id',
    );
    expect(result).toEqual({ song: { id: 'song-1' } });
  });

  it('returns empty song list for short query', async () => {
    const adminService = {
      getSongsPendingApproval: jest.fn(),
      updateSongStatus: jest.fn(),
      getAnalytics: jest.fn(),
      getAllUsers: jest.fn(),
      updateUserRole: jest.fn(),
      getFallbackSongs: jest.fn(),
      addFallbackSong: jest.fn(),
      updateFallbackSong: jest.fn(),
      deleteFallbackSong: jest.fn(),
      getBannedUsers: jest.fn(),
      hardBanUser: jest.fn(),
      shadowBanUser: jest.fn(),
      restoreUser: jest.fn(),
      searchSongsForFreeRotation: jest.fn(),
      searchUsersForFreeRotation: jest.fn(),
      getUserSongsForFreeRotation: jest.fn(),
      toggleFreeRotation: jest.fn(),
      getSongsInFreeRotation: jest.fn(),
    };
    const controller = new AdminController(adminService as any);

    const result = await controller.searchSongsForFreeRotation('a');

    expect(result).toEqual({ songs: [] });
    expect(adminService.searchSongsForFreeRotation).not.toHaveBeenCalled();
  });
});
