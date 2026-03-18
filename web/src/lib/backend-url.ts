/**
 * Returns the backend base URL with a valid protocol (https:// or http://).
 * If BACKEND_URL or NEXT_PUBLIC_API_URL is set without a scheme (e.g. "backend.example.com"),
 * we prepend https:// so fetch() does not throw ERR_INVALID_URL.
 */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function getBackendBaseUrls(): string[] {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:3000',
  ].filter((value): value is string => !!value && value.trim().length > 0);

  const normalized: string[] = [];
  for (const candidate of candidates) {
    const url = normalizeBaseUrl(candidate);
    if (!normalized.includes(url)) {
      normalized.push(url);
    }
  }
  return normalized;
}

export function getBackendBaseUrl(): string {
  return getBackendBaseUrls()[0]!;
}
