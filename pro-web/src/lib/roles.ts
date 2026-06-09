export function hasArtistCapability(
  role: string | null | undefined,
): boolean {
  return role === 'artist' || role === 'admin' || role === 'dj' || role === 'musician';
}
