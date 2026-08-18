import { DiscoveryController } from './discovery.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('music-metadata', () => ({ parseBuffer: jest.fn() }), {
  virtual: true,
});

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('DiscoveryController', () => {
  const discovery = {
    listPeopleDirectory: jest.fn().mockResolvedValue({
      items: [],
      byCity: [],
      byZip: [],
      total: 0,
    }),
    likePost: jest.fn().mockResolvedValue(undefined),
  };
  const uploads = { uploadFeedPostMedia: jest.fn() };
  const durationService = { extractDuration: jest.fn() };
  const proNetworkSubscription = { getAccess: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-1', role: 'listener' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);
  });

  it('lists people directory for current viewer', async () => {
    const controller = new DiscoveryController(
      discovery as any,
      uploads as any,
      durationService as any,
      proNetworkSubscription as any,
    );

    const result = await controller.listPeopleDirectory(
      { uid: 'firebase-1' } as any,
      '33.7',
      '-84.4',
      '40',
      '100',
    );

    expect(discovery.listPeopleDirectory).toHaveBeenCalledWith({
      viewerUserId: 'user-1',
      lat: 33.7,
      lng: -84.4,
      radiusKm: 40,
      limit: 100,
      include: undefined,
      role: undefined,
    });
    expect(result.total).toBe(0);
  });

  it('forwards include and role filters to the directory', async () => {
    const controller = new DiscoveryController(
      discovery as any,
      uploads as any,
      durationService as any,
      proNetworkSubscription as any,
    );

    await controller.listPeopleDirectory(
      { uid: 'firebase-1' } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      'studios',
      'artist',
    );

    expect(discovery.listPeopleDirectory).toHaveBeenCalledWith({
      viewerUserId: 'user-1',
      lat: undefined,
      lng: undefined,
      radiusKm: undefined,
      limit: undefined,
      include: 'studios',
      role: 'artist',
    });
  });

  it('likes a feed post', async () => {
    const controller = new DiscoveryController(
      discovery as any,
      uploads as any,
      durationService as any,
      proNetworkSubscription as any,
    );

    await expect(
      controller.likePost({ uid: 'firebase-1' } as any, 'post-1'),
    ).resolves.toEqual({ ok: true });
    expect(discovery.likePost).toHaveBeenCalledWith('user-1', 'post-1');
  });
});
