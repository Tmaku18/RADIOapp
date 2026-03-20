/**
 * Normalize social / website URLs before @IsUrl validation.
 * Users often paste hostnames or handles without https://, which class-validator rejects.
 */

function emptyToUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

/** Add https:// when there is no protocol (for domain-style URLs). */
export function normalizeWebsiteUrl(value: unknown): string | undefined {
  const raw = emptyToUndefined(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `https://${raw.replace(/^\/+/, '')}`;
}

/** Instagram: full URL, instagram.com/..., or @handle / bare username */
export function normalizeInstagramUrl(value: unknown): string | undefined {
  const raw = emptyToUndefined(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  const s = raw.replace(/^@+/, '').trim();
  if (!s) return undefined;

  if (/instagram\.com|instagr\.am/i.test(s)) {
    return s.includes('://') ? s : `https://${s.replace(/^\/+/, '')}`;
  }

  // Typical Instagram username (no slashes)
  if (/^[a-z0-9._]{1,30}$/i.test(s)) {
    return `https://www.instagram.com/${s}/`;
  }

  return `https://${s.replace(/^\/+/, '')}`;
}

/** Twitter / X */
export function normalizeTwitterUrl(value: unknown): string | undefined {
  const raw = emptyToUndefined(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  const s = raw.replace(/^@+/, '').trim();
  if (!s) return undefined;

  if (/twitter\.com|x\.com/i.test(s)) {
    return s.includes('://') ? s : `https://${s.replace(/^\/+/, '')}`;
  }

  if (/^[a-zA-Z0-9_]{1,15}$/.test(s)) {
    return `https://twitter.com/${s}`;
  }

  return `https://${s.replace(/^\/+/, '')}`;
}

/** YouTube: channel URLs, youtu.be, or @handle */
export function normalizeYoutubeUrl(value: unknown): string | undefined {
  const raw = emptyToUndefined(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  let s = raw.trim();
  if (!s) return undefined;

  if (/youtube\.com|youtu\.be/i.test(s)) {
    return s.includes('://') ? s : `https://${s.replace(/^\/+/, '')}`;
  }

  if (s.startsWith('@')) {
    s = s.replace(/^@+/, '').trim();
    if (s) return `https://www.youtube.com/@${s}`;
    return undefined;
  }

  return `https://${s.replace(/^\/+/, '')}`;
}

/** TikTok: profile URL or @handle */
export function normalizeTiktokUrl(value: unknown): string | undefined {
  const raw = emptyToUndefined(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  const s = raw.replace(/^@+/, '').trim();
  if (!s) return undefined;

  if (/tiktok\.com/i.test(s)) {
    return s.includes('://') ? s : `https://${s.replace(/^\/+/, '')}`;
  }

  if (/^[a-zA-Z0-9._]{1,50}$/.test(s)) {
    return `https://www.tiktok.com/@${s}`;
  }

  return `https://${s.replace(/^\/+/, '')}`;
}
