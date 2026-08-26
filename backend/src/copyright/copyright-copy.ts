/**
 * Shared copyright-match copy for artist APIs, Studio, email, and push.
 * Keep payloads lean: title / artists / album / label / score only.
 */

export type PublicCopyrightMatch = {
  title: string | null;
  artists: string[];
  album: string | null;
  label: string | null;
  score: number | null;
};

export function parseCopyrightMatch(raw: unknown): PublicCopyrightMatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title =
    typeof obj.title === 'string' && obj.title.trim()
      ? obj.title.trim()
      : null;
  const artists: string[] = [];
  if (Array.isArray(obj.artists)) {
    for (const artist of obj.artists) {
      if (typeof artist === 'string' && artist.trim()) {
        artists.push(artist.trim());
      }
    }
  } else if (typeof obj.artists === 'string' && obj.artists.trim()) {
    for (const artist of obj.artists.split(',')) {
      if (artist.trim()) artists.push(artist.trim());
    }
  }
  const album =
    typeof obj.album === 'string' && obj.album.trim()
      ? obj.album.trim()
      : null;
  const label =
    typeof obj.label === 'string' && obj.label.trim()
      ? obj.label.trim()
      : null;
  const scoreRaw =
    typeof obj.score === 'number'
      ? obj.score
      : typeof obj.score === 'string'
        ? Number(obj.score)
        : null;
  const score =
    scoreRaw != null && Number.isFinite(scoreRaw) ? scoreRaw : null;
  if (!title && artists.length === 0 && !album && !label && score == null) {
    return null;
  }
  return { title, artists, album, label, score };
}

export function toPublicCopyrightMatch(
  raw: unknown,
): PublicCopyrightMatch | null {
  return parseCopyrightMatch(raw);
}

export function copyrightMatchTitle(match: PublicCopyrightMatch): string {
  return match.title ?? 'an existing recording';
}

export function copyrightMatchArtists(match: PublicCopyrightMatch): string {
  return match.artists.length ? match.artists.join(', ') : 'unknown';
}

export function buildCopyrightRejectionReason(
  match: PublicCopyrightMatch,
): string {
  const score =
    typeof match.score === 'number'
      ? ` (confidence ${Math.round(match.score)}%)`
      : '';
  return `Possible copyright match detected: "${copyrightMatchTitle(match)}" by ${copyrightMatchArtists(match)}${score}. If you own or have rights to this recording, contact support to appeal.`;
}

export function copyrightUploaderNoticeTitle(songTitle: string): string {
  return `Possible copyright match on "${songTitle}"`;
}

export function copyrightUploaderNoticeBody(
  match: PublicCopyrightMatch,
): string {
  return `ACRCloud matched this to "${copyrightMatchTitle(match)}" by ${copyrightMatchArtists(match)}. If you own or control that recording, we can still approve it — reply to support with proof.`;
}
