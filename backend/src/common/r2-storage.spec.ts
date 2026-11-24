import { r2ObjectKey, storedObjectUrl } from './r2-storage';

describe('r2 object keys', () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it('prefixes shared-bucket objects with the logical name', () => {
    delete process.env.R2_BUCKET_ARTWORK;
    process.env.R2_BUCKET_PUBLIC = 'networx-media';
    expect(r2ObjectKey('artwork', 'user/file.webp')).toBe('artwork/user/file.webp');
  });

  it('keeps song keys unprefixed in a dedicated songs bucket', () => {
    process.env.R2_BUCKET_SONGS = 'networx-songs';
    expect(r2ObjectKey('songs', 'user/track.mp3')).toBe('user/track.mp3');
  });

  it('keeps song references on the supabase public path', () => {
    process.env.SUPABASE_URL = 'https://db.example.co';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET_SONGS = 'networx-songs';
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com';
    expect(storedObjectUrl('songs', 'user/track.mp3')).toBe(
      'https://db.example.co/storage/v1/object/public/songs/user/track.mp3',
    );
  });

  it('serves public images from the R2 base URL', () => {
    process.env.SUPABASE_URL = 'https://db.example.co';
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    delete process.env.R2_BUCKET_ARTWORK;
    process.env.R2_BUCKET_PUBLIC = 'networx-media';
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com';
    expect(storedObjectUrl('artwork', 'user/cover.webp')).toBe(
      'https://media.example.com/artwork/user/cover.webp',
    );
  });
});
