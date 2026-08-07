'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { albumsApi, type ArtistAlbum } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArtworkImage } from '@/components/common/ArtworkImage';

type SongLite = {
  id: string;
  title: string;
  artworkUrl?: string | null;
  albumId?: string | null;
  productKind?: string;
};

type Props = {
  songs: SongLite[];
  onChanged?: () => void;
};

export function AlbumsManageCard({ songs, onChanged }: Props) {
  const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [releaseType, setReleaseType] = useState('album');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [savingTracks, setSavingTracks] = useState(false);

  const songOptions = useMemo(
    () => songs.filter((s) => (s.productKind ?? 'song') !== 'beat'),
    [songs],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await albumsApi.listMine();
      setAlbums(res.data.albums ?? []);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load albums';
      setError(typeof msg === 'string' ? msg : 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (album: ArtistAlbum) => {
    setEditingId(album.id);
    const ids = songOptions
      .filter((s) => s.albumId === album.id)
      .map((s) => s.id);
    setSelectedSongIds(ids);
  };

  const createAlbum = async () => {
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await albumsApi.create({ title: trimmed, releaseType });
      setTitle('');
      setAlbums((prev) => [res.data, ...prev]);
      setEditingId(res.data.id);
      setSelectedSongIds([]);
      onChanged?.();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to create album';
      setError(typeof msg === 'string' ? msg : 'Failed to create album');
    } finally {
      setCreating(false);
    }
  };

  const saveTracks = async () => {
    if (!editingId || savingTracks) return;
    setSavingTracks(true);
    setError(null);
    try {
      await albumsApi.setTracks(editingId, selectedSongIds);
      await load();
      onChanged?.();
      setEditingId(null);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to update album tracks';
      setError(typeof msg === 'string' ? msg : 'Failed to update album tracks');
    } finally {
      setSavingTracks(false);
    }
  };

  const removeAlbum = async (id: string) => {
    if (!window.confirm('Delete this album? Songs stay uploaded — they become singles again.')) {
      return;
    }
    setError(null);
    try {
      await albumsApi.remove(id);
      setAlbums((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) setEditingId(null);
      onChanged?.();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to delete album';
      setError(typeof msg === 'string' ? msg : 'Failed to delete album');
    }
  };

  const toggleSong = (songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId],
    );
  };

  const moveSelected = (songId: string, dir: -1 | 1) => {
    setSelectedSongIds((prev) => {
      const idx = prev.indexOf(songId);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Albums</h2>
          <p className="text-sm text-muted-foreground">
            Group uploads into albums, EPs, or mixtapes on your artist page.
            Radio and sales stay per-song.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="New album title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value)}
          >
            <option value="album">Album</option>
            <option value="ep">EP</option>
            <option value="mixtape">Mixtape</option>
            <option value="single">Single</option>
          </select>
          <Button
            type="button"
            onClick={() => void createAlbum()}
            disabled={!title.trim() || creating}
          >
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading albums…</p>
        ) : albums.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No albums yet. Create one, then assign tracks.
          </p>
        ) : (
          <ul className="space-y-3">
            {albums.map((album) => (
              <li
                key={album.id}
                className="rounded-lg border border-border p-3 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <ArtworkImage
                    src={album.artworkUrl}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {album.releaseType} · {album.trackCount} track
                      {album.trackCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(album)}
                  >
                    Manage tracks
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeAlbum(album.id)}
                  >
                    Delete
                  </Button>
                </div>

                {editingId === album.id && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">
                      Select tracks and use arrows to set order.
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {songOptions.map((song) => {
                        const checked = selectedSongIds.includes(song.id);
                        const order = checked
                          ? selectedSongIds.indexOf(song.id) + 1
                          : null;
                        return (
                          <div
                            key={song.id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSong(song.id)}
                            />
                            <span className="w-6 text-xs text-muted-foreground tabular-nums">
                              {order ?? '—'}
                            </span>
                            <span className="flex-1 text-sm truncate">
                              {song.title}
                            </span>
                            {checked && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => moveSelected(song.id, -1)}
                                >
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => moveSelected(song.id, 1)}
                                >
                                  ↓
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void saveTracks()}
                        disabled={savingTracks}
                      >
                        {savingTracks ? 'Saving…' : 'Save track list'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
