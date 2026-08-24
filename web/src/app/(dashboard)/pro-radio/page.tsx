'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayback } from '@/components/playback';
import { ProRadioPaywallCard } from '@/components/pro-radio/ProRadioPaywallCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  proRadioPlaylistsApi,
  proRadioSubscriptionApi,
  type ProRadioPlaylist,
  type ProRadioPlaylistTrack,
} from '@/lib/api';
import {
  PRO_RADIO_INTRO_DISPLAY,
  PRO_RADIO_REGULAR_DISPLAY,
} from '@/data/pro-radio-pricing';

export default function ProRadioPage() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { state, actions } = usePlayback();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [playlists, setPlaylists] = useState<ProRadioPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlaylistId, setExpandedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<ProRadioPlaylistTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setHasAccess(false);
      setPlaylists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const accessRes = await proRadioSubscriptionApi.getAccess();
      const access = accessRes.data?.hasAccess === true;
      setHasAccess(access);
      if (!access) {
        setPlaylists([]);
        return;
      }
      // Playlist failures must not revoke access (same bug as the mobile hub).
      try {
        const plRes = await proRadioPlaylistsApi.listMine();
        setPlaylists(plRes.data?.playlists ?? []);
      } catch {
        setPlaylists([]);
        toast.error('Playlists are temporarily unavailable. Pull to refresh.');
      }
    } catch {
      setHasAccess(false);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (searchParams.get('pro_radio') === 'success') {
      toast.success('Pro-Radio subscription active!');
    }
    if (searchParams.get('pro_radio') === 'canceled') {
      toast.message('Checkout canceled.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const createPlaylist = async () => {
    const title = window.prompt('Playlist name');
    if (!title?.trim()) return;
    try {
      await proRadioPlaylistsApi.create({ title: title.trim() });
      await load();
    } catch {
      toast.error('Could not create playlist.');
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    setTracksLoading(true);
    try {
      const res = await proRadioPlaylistsApi.getTracks(playlistId);
      setPlaylistTracks((res.data?.tracks ?? []) as ProRadioPlaylistTrack[]);
    } catch {
      setPlaylistTracks([]);
      toast.error('Could not load playlist tracks.');
    } finally {
      setTracksLoading(false);
    }
  };

  const toggleManagePlaylist = async (playlistId: string) => {
    if (expandedPlaylistId === playlistId) {
      setExpandedPlaylistId(null);
      setPlaylistTracks([]);
      return;
    }
    setExpandedPlaylistId(playlistId);
    await loadPlaylistTracks(playlistId);
  };

  const removeTrack = async (playlistId: string, songId: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from this playlist?`)) return;
    setRemovingSongId(songId);
    try {
      await proRadioPlaylistsApi.removeTrack(playlistId, songId);
      setPlaylistTracks((prev) => prev.filter((t) => t.songId !== songId));
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId && pl.trackCount != null
            ? { ...pl, trackCount: Math.max(0, pl.trackCount - 1) }
            : pl,
        ),
      );
      toast.success(`Removed "${title}"`);
    } catch {
      toast.error('Could not remove song.');
    } finally {
      setRemovingSongId(null);
    }
  };

  const playPlaylist = async (playlistId: string, startSongId?: string) => {
    try {
      const res = await proRadioPlaylistsApi.getTracks(playlistId);
      const tracks = (res.data?.tracks ?? []) as ProRadioPlaylistTrack[];
      const queue = tracks
        .filter((t) => (t.streamUrl ?? '').trim().length > 0)
        .map((t) => ({
          id: t.songId,
          title: t.title,
          artistName: t.artistName ?? 'Artist',
          artistId: t.artistId ?? null,
          artworkUrl: t.artworkUrl ?? null,
          audioUrl: t.streamUrl!,
          durationSeconds: t.durationSeconds ?? 0,
        }));
      if (!queue.length) {
        toast.error('No playable tracks in this playlist yet.');
        return;
      }
      let startIndex = 0;
      if (startSongId) {
        const idx = queue.findIndex((t) => t.id === startSongId);
        if (idx >= 0) startIndex = idx;
      }
      actions.playProRadioQueue(queue, startIndex);
      await actions.play();
    } catch {
      toast.error('Could not play playlist.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-muted-foreground">Loading…</div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Pro-Radio</h1>
        <p className="text-muted-foreground">
          Sign in to subscribe and build on-demand playlists.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Pro-Radio</h1>
        <p className="text-muted-foreground mt-1">
          On-demand full tracks and playlists — {PRO_RADIO_INTRO_DISPLAY} first month, then{' '}
          {PRO_RADIO_REGULAR_DISPLAY}/mo, or Pro Bundle at $12.99/mo for Pro-Radio + Pro-Networx.
          Live Networks Radio is separate.
        </p>
      </div>

      {hasAccess !== true && (
        <ProRadioPaywallCard onAccessKnown={(a) => setHasAccess(a?.hasAccess === true)} />
      )}

      {hasAccess === true && (
        <>
          {state.source === 'proRadio' && state.track && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Now playing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-medium">{state.track.title}</p>
                <p className="text-sm text-muted-foreground">{state.track.artistName}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => actions.skipPrevious()}>
                    Previous
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void actions.togglePlay()}>
                    {state.isPlaying ? 'Pause' : 'Play'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => actions.skipNext()}>
                    Next
                  </Button>
                  <Button
                    type="button"
                    variant={state.proRadioShuffle ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => actions.toggleShuffle()}
                  >
                    Shuffle
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your playlists</h2>
            <Button type="button" size="sm" onClick={() => void createPlaylist()}>
              New playlist
            </Button>
          </div>

          {playlists.length === 0 ? (
            <p className="text-muted-foreground text-sm">No playlists yet. Create one to get started.</p>
          ) : (
            <ul className="space-y-2">
              {playlists.map((pl) => {
                const expanded = expandedPlaylistId === pl.id;
                return (
                  <li key={pl.id}>
                    <Card>
                      <CardContent className="py-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{pl.title}</p>
                            {pl.trackCount != null && (
                              <p className="text-xs text-muted-foreground">
                                {pl.trackCount} track{pl.trackCount === 1 ? '' : 's'}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void toggleManagePlaylist(pl.id)}
                            >
                              {expanded ? 'Hide' : 'Manage'}
                            </Button>
                            <Button type="button" size="sm" onClick={() => void playPlaylist(pl.id)}>
                              Play
                            </Button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="border-t pt-3 space-y-2">
                            {tracksLoading ? (
                              <p className="text-sm text-muted-foreground">Loading tracks…</p>
                            ) : playlistTracks.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No songs yet. Add some from artist pages or radio.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {playlistTracks.map((t) => (
                                  <li
                                    key={t.songId}
                                    className="flex items-center justify-between gap-2 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{t.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {t.artistName ?? 'Artist'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {(t.streamUrl ?? '').trim() && (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => void playPlaylist(pl.id, t.songId)}
                                        >
                                          Play
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={removingSongId === t.songId}
                                        onClick={() =>
                                          void removeTrack(pl.id, t.songId, t.title)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
