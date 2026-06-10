'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { djBoothApi } from '@/lib/api';

type QueueEntry = {
  position: number;
  stackId: string;
  title: string | null;
  artistName: string | null;
  durationSeconds: number;
};

type Candidate = {
  stackId: string;
  title: string;
  artistName: string;
};

type Props = {
  stationId: string;
  currentSong: { title: string | null; artistName: string | null } | null;
  draftStackIds: string[];
  draftRows: QueueEntry[];
  candidates: Candidate[];
  selectedAddStackId: string;
  hasChanges: boolean;
  busy: boolean;
  onSelectAdd: (stackId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onSave: () => void;
};

function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function QueuePanel({
  currentSong,
  draftRows,
  candidates,
  selectedAddStackId,
  hasChanges,
  busy,
  onSelectAdd,
  onMove,
  onRemove,
  onAdd,
  onSave,
}: Props) {
  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-lg">Queue</h3>
        <Button type="button" disabled={!hasChanges || busy} onClick={onSave}>
          Save order
        </Button>
      </div>

      {currentSong && (
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Now playing: </span>
          <strong>{currentSong.title || 'Untitled'}</strong>
          {currentSong.artistName ? ` — ${currentSong.artistName}` : null}
        </div>
      )}

      <ul className="space-y-1 max-h-64 overflow-y-auto">
        {draftRows.map((row, index) => (
          <li
            key={`${row.stackId}-${index}`}
            className="flex items-center gap-2 border rounded-md px-2 py-1.5 text-sm"
          >
            <span className="text-muted-foreground w-6">{index + 1}</span>
            <span className="flex-1 truncate">
              {row.title} {row.artistName ? `— ${row.artistName}` : ''}{' '}
              <span className="text-muted-foreground">({fmtDuration(row.durationSeconds)})</span>
            </span>
            <Button type="button" size="sm" variant="ghost" disabled={busy || index === 0} onClick={() => onMove(index, -1)}>
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || index >= draftRows.length - 1}
              onClick={() => onMove(index, 1)}
            >
              ↓
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onRemove(index)}>
              ✕
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="border rounded-md px-2 py-1.5 text-sm bg-background flex-1 min-w-[200px]"
          value={selectedAddStackId}
          onChange={(e) => onSelectAdd(e.target.value)}
        >
          {candidates.map((c) => (
            <option key={c.stackId} value={c.stackId}>
              {c.title} — {c.artistName}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" disabled={busy || !selectedAddStackId} onClick={onAdd}>
          Add to queue
        </Button>
      </div>
    </Card>
  );
}

export function useQueueDraft(
  upcoming: Array<{ stackId: string; title: string | null; artistName: string | null; durationSeconds: number }>,
) {
  return useMemo(
    () => upcoming.map((row, index) => ({
      position: index,
      stackId: row.stackId,
      title: row.title,
      artistName: row.artistName,
      durationSeconds: row.durationSeconds,
    })),
    [upcoming],
  );
}

export async function saveQueueOrder(stationId: string, stackIds: string[]) {
  await djBoothApi.replaceQueue(stationId, stackIds);
}

export async function addToQueue(
  stationId: string,
  stackId: string,
  position?: number,
) {
  await djBoothApi.addQueueEntries(stationId, {
    items: [{ stackId, source: 'songs' }],
    position,
    allowDuplicates: false,
  });
}
