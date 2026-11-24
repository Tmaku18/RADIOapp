import { getSupabaseClient } from '../config/supabase.config';
import {
  deleteR2Object,
  headR2Object,
  putR2Object,
  r2Enabled,
  r2PublicUrl,
  storedObjectUrl,
  supabasePublicObjectUrl,
} from './r2-storage';

export const STORAGE_CACHE_CONTROL = '31536000';

/** Upload bytes to R2 when configured, otherwise to Supabase Storage. */
export async function uploadStoredObject(
  logical: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const clean = key.replace(/^\/+/, '');
  if (r2Enabled(logical)) {
    await putR2Object(logical, clean, body, contentType);
    return storedObjectUrl(logical, clean);
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(logical).upload(clean, body, {
    contentType,
    upsert: false,
    cacheControl: STORAGE_CACHE_CONTROL,
  });
  if (error) {
    throw new Error(error.message);
  }
  return supabasePublicObjectUrl(logical, clean);
}

/** Remove an object from R2 and from Supabase. Missing objects are ignored. */
export async function deleteStoredObject(
  logical: string,
  key: string,
): Promise<void> {
  const clean = decodeURIComponent(key).replace(/^\/+/, '').split('?')[0];
  if (!clean) return;
  if (r2Enabled(logical)) {
    await deleteR2Object(logical, clean);
  }
  const supabase = getSupabaseClient();
  await supabase.storage.from(logical).remove([clean]);
}

export async function storedObjectExists(
  logical: string,
  key: string,
): Promise<boolean> {
  const clean = key.replace(/^\/+/, '');
  if (r2Enabled(logical)) {
    return headR2Object(logical, clean);
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('name')
    .eq('bucket_id', logical)
    .eq('name', clean)
    .maybeSingle();
  if (error) return true;
  return Boolean(data);
}

/** Public URL for a logical key, preferring the R2 CDN for public buckets. */
export function publicObjectUrl(logical: string, key: string): string {
  return r2PublicUrl(logical, key) ?? supabasePublicObjectUrl(logical, key);
}

/**
 * Pull the object key out of a Supabase public URL or an R2 public URL.
 * When `logical` is set, a shared-bucket R2 prefix (`feed/...`) is stripped.
 */
export function storageKeyFromUrl(
  url: string,
  logical?: string,
): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const after = parsed.pathname.slice(markerIndex + marker.length);
      const slash = after.indexOf('/');
      if (slash < 0) return null;
      return decodeURIComponent(after.slice(slash + 1));
    }
    const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
    if (base && url.startsWith(`${base}/`)) {
      let rest = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      if (logical && rest.startsWith(`${logical}/`)) {
        rest = rest.slice(logical.length + 1);
      }
      return rest || null;
    }
  } catch {
    return null;
  }
  return null;
}
