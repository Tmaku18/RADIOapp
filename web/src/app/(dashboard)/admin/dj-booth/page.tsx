'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { adminApi, djBoothApi } from '@/lib/api';
import { DEFAULT_STATION_ID } from '@/data/station-map';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TransportControls } from '@/components/admin/dj-booth/TransportControls';
import { MicPanel } from '@/components/admin/dj-booth/MicPanel';
import { SoundboardPanel, type SoundboardClip } from '@/components/admin/dj-booth/SoundboardPanel';
import {
  QueuePanel,
  addToQueue,
  saveQueueOrder,
} from '@/components/admin/dj-booth/QueuePanel';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { Badge } from '@/components/ui/badge';

type RadioOption = { id: string; state: string; label: string };

function coerceListenerCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

export default function DjBoothPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stationParam = searchParams.get('station')?.trim() || '';

  const [radios, setRadios] = useState<RadioOption[]>([]);
  const [selectedRadioId, setSelectedRadioId] = useState(stationParam || DEFAULT_STATION_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transportPaused, setTransportPaused] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [duckVolume, setDuckVolume] = useState(0.25);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [sessionConnected, setSessionConnected] = useState(false);

  const [currentTrack, setCurrentTrack] = useState<Record<string, unknown> | null>(null);
  const [currentSong, setCurrentSong] = useState<{ title: string | null; artistName: string | null } | null>(null);
  const [draftStackIds, setDraftStackIds] = useState<string[]>([]);
  const [originalStackIds, setOriginalStackIds] = useState<string[]>([]);
  const [queueMap, setQueueMap] = useState<
    Map<string, { title: string | null; artistName: string | null; durationSeconds: number }>
  >(new Map());

  const [candidates, setCandidates] = useState<
    Array<{ stackId: string; title: string; artistName: string }>
  >([]);
  const [selectedAddStackId, setSelectedAddStackId] = useState('');
  const [clips, setClips] = useState<SoundboardClip[]>([]);

  const loadRadios = useCallback(async () => {
    const res = await adminApi.getRadios();
    const list = res.data.radios || [];
    setRadios(list);
    if (list.length > 0) {
      setSelectedRadioId((prev) => {
        const existing = list.find((r) => r.id === prev);
        return existing ? existing.id : list[0].id;
      });
    }
  }, []);

  const loadStatus = useCallback(async (stationId: string) => {
    setError(null);
    try {
      const [statusRes, clipsRes] = await Promise.all([
        djBoothApi.getStatus(stationId),
        djBoothApi.listSoundboardClips(),
      ]);
      const data = statusRes.data;
      setTransportPaused(!!data.transport?.paused);
      setMicActive(!!data.booth?.micActive);
      setDuckVolume(data.booth?.duckVolume ?? 0.25);
      setWhipUrl(data.session?.whip_url ?? null);
      setSessionConnected(!!data.session && data.session.status === 'active');
      setCurrentTrack(data.currentTrack ?? null);
      setCurrentSong(data.queue?.currentSong ?? null);

      const upcoming = data.queue?.upcoming || [];
      const stackIds = upcoming.map((row: { stackId: string }) => row.stackId);
      setDraftStackIds(stackIds);
      setOriginalStackIds(stackIds);
      const map = new Map<
        string,
        { title: string | null; artistName: string | null; durationSeconds: number }
      >();
      for (const row of upcoming) {
        map.set(row.stackId, {
          title: row.title,
          artistName: row.artistName,
          durationSeconds: row.durationSeconds || 0,
        });
      }
      setQueueMap(map);

      setClips(Array.isArray(clipsRes.data) ? clipsRes.data : clipsRes.data?.clips ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load DJ booth');
    }
  }, []);

  const loadCandidates = useCallback(async (stationId: string) => {
    try {
      const songsRes = await adminApi.getSongsInFreeRotation(stationId);
      const songsRaw = (songsRes.data.songs || []) as Array<{
        id: string;
        title?: string;
        artist_name?: string;
        users?: { display_name?: string };
      }>;
      const songs = songsRaw.map((song) => ({
        stackId: song.id,
        title: song.title || 'Untitled',
        artistName: song.users?.display_name || song.artist_name || 'Unknown Artist',
      }));
      setCandidates(songs);
      setSelectedAddStackId((prev) => prev || songs[0]?.stackId || '');
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    void loadRadios();
  }, [loadRadios]);

  useEffect(() => {
    if (!selectedRadioId) return;
    void loadStatus(selectedRadioId);
    void loadCandidates(selectedRadioId);
    const interval = setInterval(() => void loadStatus(selectedRadioId), 10000);
    return () => clearInterval(interval);
  }, [selectedRadioId, loadStatus, loadCandidates]);

  useEffect(() => {
    if (!selectedRadioId) return;
    const currentStation = searchParams.get('station')?.trim() || '';
    if (currentStation === selectedRadioId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set('station', selectedRadioId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [selectedRadioId, pathname, router, searchParams]);

  const draftRows = useMemo(
    () =>
      draftStackIds.map((stackId, index) => {
        const row = queueMap.get(stackId);
        return {
          position: index,
          stackId,
          title: row?.title || stackId,
          artistName: row?.artistName || null,
          durationSeconds: row?.durationSeconds || 0,
        };
      }),
    [draftStackIds, queueMap],
  );

  const hasChanges =
    draftStackIds.length !== originalStackIds.length ||
    draftStackIds.some((v, i) => v !== originalStackIds[i]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await loadStatus(selectedRadioId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const trackTitle = String(currentTrack?.title ?? currentSong?.title ?? '—');
  const trackArtist = String(
    currentTrack?.artist_name ?? currentTrack?.artistName ?? currentSong?.artistName ?? '',
  );
  const artworkUrl =
    (currentTrack?.artwork_url as string | undefined) ??
    (currentTrack?.artworkUrl as string | undefined) ??
    null;
  const positionSec = Number(currentTrack?.position_seconds ?? 0);
  const remainingMs = Number(currentTrack?.time_remaining_ms ?? 0);
  const listenerCount = coerceListenerCount(
    currentTrack?.listener_count ?? currentTrack?.listenerCount,
  );
  const isTrackPlaying = currentTrack?.is_playing !== false;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">DJ Booth</h1>
          <p className="text-sm text-muted-foreground">
            Control the radio player, queue, mic, and soundboard for any station.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="gap-2 px-3 py-1.5 text-sm">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                listenerCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
              }`}
              aria-hidden
            />
            Live listeners: {listenerCount.toLocaleString()}
          </Badge>
          <select
            className="border rounded-md px-3 py-2 bg-background"
            value={selectedRadioId}
            onChange={(e) => setSelectedRadioId(e.target.value)}
          >
            {radios.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label || r.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <Card className="p-3 border-destructive text-destructive text-sm">{error}</Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 flex gap-4">
          <ArtworkImage
            src={artworkUrl}
            alt={trackTitle}
            className="w-24 h-24 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Now playing</p>
            <h2 className="font-semibold text-lg truncate">{trackTitle}</h2>
            <p className="text-muted-foreground truncate">{trackArtist}</p>
            <p className="text-sm mt-2">
              {Math.floor(positionSec / 60)}:{String(positionSec % 60).padStart(2, '0')} /{' '}
              {Math.ceil(remainingMs / 1000)}s left
              {transportPaused && (
                <span className="ml-2 text-amber-600 font-medium">PAUSED (global)</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {listenerCount.toLocaleString()} listener{listenerCount === 1 ? '' : 's'} on this track
              {isTrackPlaying ? '' : ' (transport paused)'}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <TransportControls
            transportPaused={transportPaused}
            busy={busy}
            onBack={() => run(() => djBoothApi.skipBack(selectedRadioId).then(() => undefined))}
            onTogglePlay={() =>
              run(() =>
                (transportPaused
                  ? djBoothApi.playTransport(selectedRadioId)
                  : djBoothApi.pauseTransport(selectedRadioId)
                ).then(() => undefined),
              )
            }
            onSkip={() => run(() => djBoothApi.skipForward(selectedRadioId).then(() => undefined))}
          />
        </Card>
      </div>

      <QueuePanel
        stationId={selectedRadioId}
        currentSong={currentSong}
        draftStackIds={draftStackIds}
        draftRows={draftRows}
        candidates={candidates}
        selectedAddStackId={selectedAddStackId}
        hasChanges={hasChanges}
        busy={busy}
        onSelectAdd={setSelectedAddStackId}
        onMove={(index, dir) => {
          const target = index + dir;
          if (target < 0 || target >= draftStackIds.length) return;
          const next = [...draftStackIds];
          const [item] = next.splice(index, 1);
          next.splice(target, 0, item);
          setDraftStackIds(next);
        }}
        onRemove={(index) => {
          const next = [...draftStackIds];
          next.splice(index, 1);
          setDraftStackIds(next);
        }}
        onAdd={() =>
          run(async () => {
            await addToQueue(selectedRadioId, selectedAddStackId);
          })
        }
        onSave={() =>
          run(async () => {
            await saveQueueOrder(selectedRadioId, draftStackIds);
            setOriginalStackIds([...draftStackIds]);
          })
        }
      />

      <MicPanel
        stationId={selectedRadioId}
        micActive={micActive}
        duckVolume={duckVolume}
        whipUrl={whipUrl}
        sessionConnected={sessionConnected}
        onRefresh={() => loadStatus(selectedRadioId)}
      />

      <SoundboardPanel
        stationId={selectedRadioId}
        clips={clips}
        onRefresh={() => loadStatus(selectedRadioId)}
      />

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <a href={`/listen?station=${encodeURIComponent(selectedRadioId)}`} target="_blank" rel="noreferrer">
            Open listener view ↗
          </a>
        </Button>
      </div>
    </div>
  );
}
