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
      if (access) {
        const plRes = await proRadioPlaylistsApi.listMine();
        setPlaylists(plRes.data?.playlists ?? []);
      } else {
        setPlaylists([]);
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

  const playPlaylist = async (playlistId: string) => {
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
      actions.playProRadioQueue(queue, 0);
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
          {PRO_RADIO_REGULAR_DISPLAY}/mo. Live Networks Radio is separate.
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
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <Card>
                    <CardContent className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{pl.title}</p>
                        {pl.trackCount != null && (
                          <p className="text-xs text-muted-foreground">{pl.trackCount} tracks</p>
                        )}
                      </div>
                      <Button type="button" size="sm" onClick={() => void playPlaylist(pl.id)}>
                        Play
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
