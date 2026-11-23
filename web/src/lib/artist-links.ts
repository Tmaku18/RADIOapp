export function artistProfilePath(artistId: string): string {
  return `/artist/${artistId}`;
}

export function publicArtistProfilePath(artistId: string): string {
  return `/open/artists/${encodeURIComponent(artistId)}`;
}

/** Login/signup entry with return path to the dashboard artist profile. */
export function artistProfileAuthEntryPath(artistId: string): string {
  const target = artistProfilePath(artistId);
  return `/login?redirect=${encodeURIComponent(target)}`;
}

/** Profile when signed in; login with redirect when not. */
export function resolveArtistProfileHref(
  artistId: string,
  isAuthenticated: boolean,
): string {
  return isAuthenticated
    ? artistProfilePath(artistId)
    : artistProfileAuthEntryPath(artistId);
}

