/**
 * Returns the backend base URL with a valid protocol (https:// or http://).
 * If BACKEND_URL or NEXT_PUBLIC_API_URL is set without a scheme (e.g. "backend.example.com"),
 * we prepend https:// so fetch() does not throw ERR_INVALID_URL.
 */
export function getBackendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000';
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
