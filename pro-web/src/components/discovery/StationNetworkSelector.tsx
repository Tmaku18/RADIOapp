'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TOWERS } from '@/data/station-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ViewMode = 'grid' | 'list';

const NODE_LAYOUT: Array<{ top: string; left: string }> = [
  { top: '12%', left: '48%' },
  { top: '24%', left: '18%' },
  { top: '24%', left: '78%' },
  { top: '38%', left: '8%' },
  { top: '38%', left: '88%' },
  { top: '52%', left: '22%' },
  { top: '52%', left: '74%' },
  { top: '66%', left: '10%' },
  { top: '66%', left: '86%' },
  { top: '80%', left: '30%' },
  { top: '80%', left: '68%' },
];

export function StationNetworkSelector({
  stationId,
  onSelectStation,
}: {
  stationId?: string | null;
  onSelectStation: (stationId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ViewMode>('grid');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOWERS;
    return TOWERS.filter(
      (tower) =>
        tower.genre.toLowerCase().includes(q) ||
        tower.city.toLowerCase().includes(q) ||
        tower.id.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Choose a station from the network tower.
        </p>
        <div className="relative h-[320px] rounded-lg border border-border/60 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40" />
          <div className="absolute left-1/2 top-[54%] h-[3px] w-[240px] -translate-x-1/2 rounded-full bg-primary/30" />

          {TOWERS.map((tower, index) => {
            const node = NODE_LAYOUT[index % NODE_LAYOUT.length];
            const active = stationId === tower.id;
            return (
              <button
                key={tower.id}
                type="button"
                onClick={() => onSelectStation(tower.id)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur transition',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-lg'
                    : 'border-border bg-background/90 text-foreground hover:border-primary/50',
                )}
                style={{ top: node.top, left: node.left }}
                title={`${tower.genre} (${tower.city})`}
              >
                {tower.genre}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
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

        {mode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((tower) => (
              <button
                key={tower.id}
                type="button"
                onClick={() => onSelectStation(tower.id)}
                className={cn(
                  'rounded-lg border px-3 py-3 text-left transition',
                  stationId === tower.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <p className="font-medium">{tower.genre}</p>
                <p className="text-xs text-muted-foreground">{tower.city} (National)</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tower) => (
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
                <span className="font-medium">{tower.genre}</span>
                <span className="text-xs text-muted-foreground">{tower.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
