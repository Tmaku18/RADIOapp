'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';

export type VoteCandidateSong = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl?: string | null;
};

type Top7VotePickerProps = {
  candidates: VoteCandidateSong[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function mergeVoteCandidates(lists: VoteCandidateSong[][]): VoteCandidateSong[] {
  const byId = new Map<string, VoteCandidateSong>();
  for (const list of lists) {
    for (const song of list) {
      if (song.id && !byId.has(song.id)) byId.set(song.id, song);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );
}

export function Top7VotePicker({ candidates, selectedIds, onChange }: Top7VotePickerProps) {
  const [query, setQuery] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const byId = useMemo(() => new Map(candidates.map((s) => [s.id, s])), [candidates]);

  const selectedSongs = selectedIds
    .map((id) => byId.get(id))
    .filter((s): s is VoteCandidateSong => Boolean(s));

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((s) => {
      if (selectedIds.includes(s.id)) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) || s.artistName.toLowerCase().includes(q)
      );
    });
  }, [candidates, selectedIds, query]);

  const addSong = (id: string) => {
    if (selectedIds.includes(id) || selectedIds.length >= 7) return;
    onChange([...selectedIds, id]);
  };

  const removeSong = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const moveSong = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= selectedIds.length) return;
    const copy = [...selectedIds];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= selectedIds.length || to >= selectedIds.length) return;
    const copy = [...selectedIds];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    onChange(copy);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold">Your Top 7 (rank 1 → 7)</h3>
          <Badge variant="secondary">{selectedIds.length}/7</Badge>
        </div>
        {selectedSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
            Add songs from the list on the right. Drag or use arrows to set rank order.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedSongs.map((song, index) => (
              <li
                key={song.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex != null) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className="flex items-center gap-2 rounded-lg border bg-card p-2"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                <span className="w-7 text-center font-mono text-sm text-primary shrink-0">
                  {index + 1}
                </span>
                {song.artworkUrl ? (
                  <img src={song.artworkUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artistName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === 0}
                    onClick={() => moveSong(index, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={index === selectedSongs.length - 1}
                    onClick={() => moveSong(index, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeSong(song.id)}
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold">Add from leaderboard</h3>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or artist…"
          className="mb-3"
        />
        <ul className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {available.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              {candidates.length === 0
                ? 'No songs available yet.'
                : selectedIds.length >= 7
                  ? 'Top 7 full — remove one to swap.'
                  : 'No matches.'}
            </li>
          ) : (
            available.map((song) => (
              <li
                key={song.id}
                className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/40 transition-colors"
              >
                {song.artworkUrl ? (
                  <img src={song.artworkUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artistName}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedIds.length >= 7}
                  onClick={() => addSong(song.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
