'use client';

import { useMemo, useState } from 'react';

export type QueueSongChoice = {
  stackId: string;
  title: string;
  artistName: string;
};

/**
 * Type a title or artist and pick from the matches. The full catalog stays
 * hidden so a long free-rotation list does not have to be scrolled.
 */
export function SongQueueSearch({
  songs,
  selectedId,
  onSelect,
  disabled = false,
}: {
  songs: QueueSongChoice[];
  selectedId: string;
  onSelect: (stackId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return [];
    return songs
      .filter(
        (song) =>
          song.title.toLowerCase().includes(needle) ||
          song.artistName.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [songs, needle]);
  const selected = songs.find((song) => song.stackId === selectedId);

  const pick = (stackId: string) => {
    onSelect(stackId);
    setQuery('');
  };

  return (
    <div>
      <input
        value={query}
        disabled={disabled}
        placeholder="Search by song or artist"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const first = matches[0];
          if (first) pick(first.stackId);
        }}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      {selected ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Selected: {selected.title} — {selected.artistName}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Type to find a song, then add it next.
        </p>
      )}
      {needle ? (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-md border">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No songs match.</li>
          ) : (
            matches.map((song) => (
              <li key={song.stackId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(song.stackId)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                    song.stackId === selectedId ? 'bg-muted' : ''
                  }`}
                >
                  <span className="block truncate font-medium">{song.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {song.artistName}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
