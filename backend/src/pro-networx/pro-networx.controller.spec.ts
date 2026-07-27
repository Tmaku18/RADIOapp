import { ProNetworxController } from './pro-networx.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ProNetworxController', () => {
  const pro = {
    getMyProfile: jest.fn().mockResolvedValue({ headline: 'Producer' }),
    upsertMyProfile: jest.fn().mockResolvedValue({ ok: true }),
    listDirectory: jest.fn().mockResolvedValue({ items: [] }),
    getProfileByUserId: jest.fn().mockResolvedValue({ userId: 'u2' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-1' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);
  });

  it('returns my profile', async () => {
    const controller = new ProNetworxController(pro as any);
    await expect(
      controller.getMe({ uid: 'firebase-1' } as any),
    ).resolves.toEqual({ headline: 'Producer' });
    expect(pro.getMyProfile).toHaveBeenCalledWith('firebase-1');
  });

  it('lists directory for authenticated viewer', async () => {
    const controller = new ProNetworxController(pro as any);
    await controller.list({ uid: 'firebase-1' } as any, {
      skill: 'video',
    } as any);
    expect(pro.listDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ viewerUserId: 'user-1', skill: 'video' }),
    );
  });
});
