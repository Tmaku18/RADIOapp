'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { LyricsPlayer, LyricsPlayerSong } from '@/components/songs/LyricsPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AdminSongRow {
  id: string;
  title: string;
  artwork_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users?: {
    display_name: string;
    email: string;
  };
}

/**
 * Admin lyrics studio: pick any song from the catalog and play it in full with
 * karaoke-style synced captions (play/pause/seek), and correct the lyrics in
 * place. Playback is on-demand — not tied to the live radio rotation.
 */
export default function AdminLyricsPage() {
  const [songs, setSongs] = useState<AdminSongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await adminApi.getSongs({
          status: 'approved',
          sortBy: 'created_at',
          sortOrder: 'desc',
          limit: 100,
        });
        if (cancelled) return;
        setSongs(((response.data as { songs?: AdminSongRow[] })?.songs ?? []));
        setError(null);
      } catch {
        if (!cancelled) setError('Failed to load songs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(q) ||
        (song.users?.display_name ?? '').toLowerCase().includes(q),
    );
  }, [songs, search]);

  const selectedSong: LyricsPlayerSong | null = useMemo(() => {
    const row = songs.find((song) => song.id === selectedId);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      artistName: row.users?.display_name ?? 'Unknown artist',
      artworkUrl: row.artwork_url ?? null,
    };
  }, [songs, selectedId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      {/* Song picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Songs</CardTitle>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or artist…"
            className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Loading songs…
            </p>
          )}
          {error && <p className="px-4 pb-4 text-sm text-destructive">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              No approved songs match.
            </p>
          )}
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
            {filtered.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => setSelectedId(song.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50',
                  selectedId === song.id && 'bg-accent',
                )}
              >
                <ArtworkImage
                  src={song.artwork_url ?? null}
                  alt={song.title}
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">
                    {song.title}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {song.users?.display_name ?? 'Unknown artist'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Player + lyrics editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Player</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSong ? (
            <LyricsPlayer song={selectedSong} editable />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Pick a song on the left to play it with synced lyrics.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
