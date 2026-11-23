export type SongSortKey = 'newest' | 'oldest' | 'liked' | 'alpha' | 'heard';

export const SONG_SORT_OPTIONS: { value: SongSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'liked', label: 'Most liked' },
  { value: 'alpha', label: 'Alphabetical' },
  { value: 'heard', label: 'Most heard' },
];

type SortableSong = {
  title: string;
  createdAt: string | number | Date;
  likeCount: number;
  heardCount: number;
};

function timeOf(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortSongRows<T>(
  rows: T[],
  sort: SongSortKey,
  pick: (row: T) => SortableSong,
): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const left = pick(a);
    const right = pick(b);
    const titleOrder = left.title.localeCompare(right.title, undefined, {
      sensitivity: 'base',
    });
    switch (sort) {
      case 'oldest':
        return timeOf(left.createdAt) - timeOf(right.createdAt) || titleOrder;
      case 'liked':
        return right.likeCount - left.likeCount || titleOrder;
      case 'alpha':
        return titleOrder;
      case 'heard':
        return right.heardCount - left.heardCount || titleOrder;
      case 'newest':
      default:
        return timeOf(right.createdAt) - timeOf(left.createdAt) || titleOrder;
    }
  });
  return copy;
}
