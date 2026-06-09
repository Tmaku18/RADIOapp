import { TOWERS, type GenreId } from '@/data/station-map';

export type GenreOption = {
  id: GenreId;
  label: string;
};

/** Unique genres for onboarding picker (one label per genreId). */
export const GENRE_OPTIONS: GenreOption[] = (() => {
  const seen = new Set<string>();
  const options: GenreOption[] = [];
  for (const tower of TOWERS) {
    if (seen.has(tower.genreId)) continue;
    seen.add(tower.genreId);
    options.push({ id: tower.genreId, label: tower.genre });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
})();

export function genreLabel(genreId: string): string {
  return GENRE_OPTIONS.find((g) => g.id === genreId)?.label ?? genreId;
}
