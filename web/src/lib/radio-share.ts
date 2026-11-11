import { getStationById } from '@/data/station-map';

const SITE_ORIGIN = 'https://www.networxradio.com';

function origin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return SITE_ORIGIN;
}

export function stationDisplayName(stationId: string | null | undefined): string {
  const id = stationId?.trim();
  if (!id) return 'NetworX Radio';
  return getStationById(id)?.genre || 'NetworX Radio';
}

export function stationShareUrl(stationId: string): string {
  return `${origin()}/radio/${encodeURIComponent(stationId)}`;
}

export function artistShareUrl(artistId: string, songId?: string | null): string {
  const base = `${origin()}/artists/${encodeURIComponent(artistId)}`;
  const song = songId?.trim();
  if (!song) return base;
  return `${base}?song=${encodeURIComponent(song)}`;
}

export function stationShareText(stationId: string): string {
  const name = stationDisplayName(stationId);
  return `Listen to ${name} on NETWORX Radio.\n${stationShareUrl(stationId)}\n\nIf you don't have the app yet, this link takes you to download it.`;
}

export function artistShareText(input: {
  artistName: string;
  artistId: string;
  songTitle?: string | null;
  songId?: string | null;
}): string {
  const name = input.artistName.trim() || 'This artist';
  const title = input.songTitle?.trim();
  const lead = title
    ? `${name} is on NETWORX Radio right now with "${title}".`
    : `${name} is on NETWORX Radio.`;
  return `${lead}\n${artistShareUrl(input.artistId, input.songId)}`;
}

export async function shareLink(text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'NETWORX Radio', text, url });
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }

  const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isPhone) {
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    return 'shared';
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
