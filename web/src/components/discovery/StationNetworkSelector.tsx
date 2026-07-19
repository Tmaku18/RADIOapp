'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TOWERS } from '@/data/station-map';
import { songsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ViewMode = 'grid' | 'list';
type SortMode = 'alpha' | 'songs' | 'favorites';
type CountsState = 'idle' | 'loading' | 'ok' | 'error';

const FAV_KEY = 'networx_favorite_stations';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function saveFavorites(ids: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...ids]));
}

export function StationNetworkSelector({
  stationId,
  onSelectStation,
}: {
  stationId?: string | null;
  onSelectStation: (stationId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('songs');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsState, setCountsState] = useState<CountsState>('idle');

  const loadCounts = useCallback(async () => {
    setCountsState('loading');
    try {
      const res = await songsApi.getStationCounts();
      setCounts(res.data?.counts ?? {});
      setCountsState('ok');
    } catch {
      setCountsState('error');
    }
  }, []);

  useEffect(() => {
    setFavorites(loadFavorites());
    void loadCounts();
  }, [loadCounts]);

  const toggleFavorite = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveFavorites(next);
        return next;
      });
    },
    [],
  );

  const sorted = useMemo(() => {
    let items = [...TOWERS];

    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (t) =>
          t.genre.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q),
      );
    }

    switch (sort) {
      case 'alpha':
        items.sort((a, b) => a.genre.localeCompare(b.genre));
        break;
      case 'songs':
        items.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
        break;
      case 'favorites':
        items.sort((a, b) => {
          const af = favorites.has(a.id) ? 1 : 0;
          const bf = favorites.has(b.id) ? 1 : 0;
          if (af !== bf) return bf - af;
          return a.genre.localeCompare(b.genre);
        });
        break;
    }
    return items;
  }, [query, sort, favorites, counts]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        {countsState === 'error' && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>
              Couldn’t load station song counts. The backend may be restarting.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => void loadCounts()}
            >
              Retry
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search station..."
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'grid' ? 'default' : 'outline'}
              onClick={() => setMode('grid')}
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={mode === 'list' ? 'default' : 'outline'}
              onClick={() => setMode('list')}
            >
              List
            </Button>
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort:</span>
          {(
            [
              ['alpha', 'A–Z'],
              ['songs', 'Most Songs'],
              ['favorites', 'Favorites'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={sort === key ? 'secondary' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setSort(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {mode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sorted.map((tower) => {
              const isFav = favorites.has(tower.id);
              const songCount = counts[tower.id] ?? 0;
              return (
                <button
                  key={tower.id}
                  type="button"
                  onClick={() => onSelectStation(tower.id)}
                  className={cn(
                    'relative rounded-lg border px-3 py-3 text-left transition group',
                    stationId === tower.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(tower.id, e)}
                    className="absolute top-2 right-2 text-base opacity-60 hover:opacity-100 transition-opacity"
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFav ? '★' : '☆'}
                  </button>
                  <p className="font-medium pr-6">{tower.genre}</p>
                  <p className="text-xs text-muted-foreground">
                    {countsState === 'loading'
                      ? 'Loading…'
                      : countsState === 'error'
                        ? '—'
                        : songCount > 0
                          ? `${songCount} song${songCount !== 1 ? 's' : ''}`
                          : 'No songs yet'}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((tower) => {
              const isFav = favorites.has(tower.id);
              const songCount = counts[tower.id] ?? 0;
              return (
                <button
                  key={tower.id}
                  type="button"
                  onClick={() => onSelectStation(tower.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 flex items-center justify-between text-left transition',
                    stationId === tower.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(tower.id, e)}
                      className="text-base opacity-60 hover:opacity-100 transition-opacity"
                      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFav ? '★' : '☆'}
                    </button>
                    <span className="font-medium">{tower.genre}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {countsState === 'loading'
                      ? 'Loading…'
                      : countsState === 'error'
                        ? '—'
                        : songCount > 0
                          ? `${songCount} song${songCount !== 1 ? 's' : ''}`
                          : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
