/**
 * Remembers when a song's votes or rating last changed on this server.
 * Cached temperature readings older than that are treated as stale, so a vote
 * shows up on the very next read instead of after the cache expires.
 */
const changedAt = new Map<string, number>();
const MAX_TRACKED = 2000;

export function markVotesChanged(songId: string | null | undefined): void {
  const id = songId?.trim();
  if (!id) return;
  changedAt.set(id, Date.now());
  if (changedAt.size > MAX_TRACKED) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, at] of changedAt) {
      if (at < cutoff) changedAt.delete(key);
    }
  }
}

/** True when the song's votes changed at or after the given timestamp. */
export function votesChangedSince(songId: string, since: number): boolean {
  return (changedAt.get(songId) ?? 0) >= since;
}
