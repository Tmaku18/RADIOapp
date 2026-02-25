import { ArtistLiveService } from './artist-live.service';

describe('ArtistLiveService', () => {
  const createService = () =>
    new ArtistLiveService({} as any, {} as any);

  afterEach(() => {
    delete process.env.ARTIST_LIVE_ENABLED;
  });

  it('rejects when artist live feature flag is disabled', async () => {
    process.env.ARTIST_LIVE_ENABLED = 'false';
    const service = createService();
    await expect(
      service.getArtistStatus('artist-id'),
    ).rejects.toThrow('Artist livestream is currently disabled');
  });

  it('rejects malformed Cloudflare webhook payload', async () => {
    process.env.ARTIST_LIVE_ENABLED = 'true';
    const service = createService();
    await expect(
      service.processCloudflareWebhook({ eventType: 'live_input.connected' }),
    ).rejects.toThrow('Malformed webhook payload');
  });
});

