export function artistProfilePath(artistId: string): string {
  return `/artist/${artistId}`;
}

export function publicArtistProfilePath(artistId: string): string {
  return `/artists/${artistId}`;
}

