import { getSupabaseClient } from '../config/supabase.config';

/**
 * Storage helpers for song audio. Full tracks live in the `songs` bucket and
 * must only be handed to clients as short-lived signed URLs through
 * purchase/owner/admin-gated endpoints. 30-second samples are rendered into the
 * same bucket and may also be signed for preview playback.
 */

const SONGS_BUCKET = 'songs';
const PUBLIC_MARKER = '/storage/v1/object/public/';

// Small in-process cache so repeated reads of the same object don't hammer the
// storage signing endpoint. Signed URLs are valid for an hour; we re-sign well
// before expiry.
const signedUrlCache = new Map<string, { value: string; at: number }>();
const SIGNED_URL_TTL_MS = 45 * 60 * 1000;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

/**
 * Parse a stored `songs`-bucket reference (full public URL or bare path) into
 * the object path inside the bucket. Returns null when the value does not point
 * at the songs bucket.
 */
export function parseSongStoragePath(value: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const normalized = raw.startsWith('http://')
    ? `https://${raw.slice('http://'.length)}`
    : raw;

  if (!normalized.startsWith('https://')) {
    let path = normalized.replace(/^\/+/, '');
    if (path.startsWith(`${SONGS_BUCKET}/`)) {
      path = path.slice(`${SONGS_BUCKET}/`.length);
    }
    return path || null;
  }

  const markerIndex = normalized.indexOf(PUBLIC_MARKER);
  if (markerIndex === -1) {
    // Could be a signed URL already (/object/sign/...). Leave as-is.
    return null;
  }
  const after = normalized.slice(markerIndex + PUBLIC_MARKER.length);
  const [bucket, ...rest] = after.split('/');
  if (bucket !== SONGS_BUCKET || rest.length === 0) return null;
  return rest.join('/').split('?')[0];
}

/**
 * Convert a stored songs-bucket reference into a short-lived signed URL. Falls
 * back to returning the original value when it is not a songs-bucket object
 * (e.g. an external URL) and null when signing fails.
 */
export async function signSongAudioUrl(
  value: string | null,
  options?: { download?: boolean | string; expiresInSeconds?: number },
): Promise<string | null> {
  if (!value || typeof value !== 'string') return null;
  const path = parseSongStoragePath(value);
  if (!path) {
    // Not a songs-bucket object; return the trimmed original (external URL).
    return value.trim() || null;
  }

  const wantsDownload = options?.download ?? false;
  const expiry = options?.expiresInSeconds ?? SIGNED_URL_EXPIRY_SECONDS;
  const cacheKey = `${path}|${wantsDownload ? 'dl' : 'stream'}|${expiry}`;

  if (!wantsDownload) {
    const hit = signedUrlCache.get(cacheKey);
    if (hit && Date.now() - hit.at < SIGNED_URL_TTL_MS) {
      return hit.value;
    }
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(SONGS_BUCKET)
      .createSignedUrl(
        path,
        expiry,
        wantsDownload ? { download: wantsDownload } : undefined,
      );
    if (error || !data?.signedUrl) return null;
    if (!wantsDownload) {
      signedUrlCache.set(cacheKey, { value: data.signedUrl, at: Date.now() });
    }
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Compute the effective 30-second sample window for a song. Falls back to the
 * first 30 seconds when no explicit window is stored.
 */
export function resolveSampleWindow(song: {
  sample_start_seconds?: number | null;
  sample_end_seconds?: number | null;
  duration_seconds?: number | null;
}): { startSeconds: number; endSeconds: number } {
  const SAMPLE_MAX = 30;
  const duration = Math.max(0, Number(song.duration_seconds ?? 0) || 0);
  let start = Math.max(0, Math.floor(Number(song.sample_start_seconds ?? 0) || 0));
  if (duration > 0 && start > duration) start = 0;

  const storedEnd = Number(song.sample_end_seconds ?? 0) || 0;
  let end = storedEnd > start ? storedEnd : start + SAMPLE_MAX;
  if (end - start > SAMPLE_MAX) end = start + SAMPLE_MAX;
  if (duration > 0 && end > duration) end = duration;
  if (end <= start) end = start + Math.min(SAMPLE_MAX, duration > 0 ? duration : SAMPLE_MAX);
  return { startSeconds: start, endSeconds: end };
}

export const SONG_SAMPLE_MAX_SECONDS = 30;
export const SONG_SAMPLE_MIN_SECONDS = 5;
