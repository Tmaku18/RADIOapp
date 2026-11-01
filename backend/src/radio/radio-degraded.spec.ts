import { buildDegradedStation } from './radio-degraded';

describe('degraded station', () => {
  it('replays the last good song when the queue is empty', () => {
    const payload = buildDegradedStation({
      now: '2026-11-01T00:00:00.000Z',
      lastGood: {
        id: 'song-1',
        title: 'Night Drive',
        artist_name: 'Ada',
        audio_url: 'https://cdn.example/song.mp3',
        duration_seconds: 90,
      },
      jingleUrl: 'https://cdn.example/jingle.mp3',
    });
    expect(payload?.id).toBe('song-1');
    expect(payload?.degraded).toBe(true);
    expect(payload?.no_content).toBe(false);
  });

  it('falls through to the jingle when nothing was cached', () => {
    const payload = buildDegradedStation({
      now: '2026-11-01T00:00:00.000Z',
      lastGood: null,
      jingleUrl: 'https://cdn.example/jingle.mp3',
    });
    expect(payload?.is_jingle).toBe(true);
    expect(payload?.audio_url).toBe('https://cdn.example/jingle.mp3');
  });

  it('returns null when there is neither a cache nor a jingle', () => {
    expect(
      buildDegradedStation({
        now: '2026-11-01T00:00:00.000Z',
        lastGood: null,
        jingleUrl: null,
      }),
    ).toBeNull();
  });
});
