'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type RadioOption = { id: string; state: string; label: string };
type QueueEntry = {
  position: number;
  stackId: string;
  normalizedSongId: string;
  source: 'songs' | 'admin_fallback' | null;
  title: string | null;
  artistName: string | null;
  artworkUrl: string | null;
  durationSeconds: number;
};
type QueueState = {
  radioId: string;
  currentSong: { title: string | null; artistName: string | null } | null;
  upcoming: QueueEntry[];
};
type Candidate = {
  stackId: string;
  title: string;
  artistName: string;
  source: 'songs' | 'admin_fallback';
};

function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  type MaybeApiError = { response?: { data?: { message?: unknown } } };
  const maybeApiError = error as MaybeApiError;
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    maybeApiError.response?.data?.message
  ) {
    const msg = maybeApiError.response?.data?.message;
    return typeof msg === 'string' ? msg : fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function AdminQueuePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stationParam = searchParams.get('station')?.trim() || '';
  const [radios, setRadios] = useState<RadioOption[]>([]);
  const [selectedRadioId, setSelectedRadioId] = useState<string>(stationParam || 'ga-nw-rap');
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [draftStackIds, setDraftStackIds] = useState<string[]>([]);
  const [originalStackIds, setOriginalStackIds] = useState<string[]>([]);
  const [queueCache, setQueueCache] = useState<Record<string, QueueState>>({});
  const [draftCache, setDraftCache] = useState<Record<string, string[]>>({});
  const [originalCache, setOriginalCache] = useState<Record<string, string[]>>({});
  const [songCandidates, setSongCandidates] = useState<Candidate[]>([]);
  const [fallbackCandidates, setFallbackCandidates] = useState<Candidate[]>([]);
  const [selectedAddStackId, setSelectedAddStackId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const loadQueue = useCallback(async (radioId: string, applyToView = true) => {
    if (applyToView) setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getRadioQueue(radioId, 200);
      const state = {
        radioId: res.data.radioId,
        currentSong: res.data.currentSong,
        upcoming: res.data.upcoming || [],
      };
      const stackIds = state.upcoming.map((row) => row.stackId);
      setQueueCache((prev) => ({ ...prev, [radioId]: state }));
      setDraftCache((prev) => ({ ...prev, [radioId]: stackIds }));
      setOriginalCache((prev) => ({ ...prev, [radioId]: stackIds }));
      if (applyToView) {
        setQueueState(state);
        setDraftStackIds(stackIds);
        setOriginalStackIds(stackIds);
      }
    } catch (err: unknown) {
      if (applyToView) {
        setError(getErrorMessage(err, 'Failed to load queue state'));
      }
    } finally {
      if (applyToView) setLoading(false);
    }
  }, []);

  const loadCandidates = useCallback(async (radioId: string) => {
    try {
      const [songsRes, fallbackRes] = await Promise.all([
        adminApi.getSongsInFreeRotation(radioId),
        adminApi.getFallbackSongs(radioId),
      ]);
      const songsRaw = (songsRes.data.songs || []) as Array<{
        id: string;
        title?: string;
        artist_name?: string;
        users?: { display_name?: string };
      }>;
      const fallbackRaw = (fallbackRes.data.songs || []) as Array<{
        id: string;
        title?: string;
        artist_name?: string;
      }>;
      const songs = songsRaw.map((song) => ({
        stackId: `song:${song.id}`,
        title: song.title || 'Untitled',
        artistName: song.users?.display_name || song.artist_name || 'Unknown Artist',
        source: 'songs' as const,
      }));
      const fallback = fallbackRaw.map((song) => ({
        stackId: `admin:${song.id}`,
        title: song.title || 'Untitled',
        artistName: song.artist_name || 'Unknown Artist',
        source: 'admin_fallback' as const,
      }));
      setSongCandidates(songs);
      setFallbackCandidates(fallback);
      setSelectedAddStackId((prev) => prev || songs[0]?.stackId || '');
    } catch {
      // Non-blocking; queue view is still useful without candidate lists.
      setSongCandidates([]);
      setFallbackCandidates([]);
    }
  }, []);

  useEffect(() => {
    loadRadios();
  }, [loadRadios]);

  // Keep local tab selection in sync with explicit URL station changes
  // (e.g. deep links, browser back/forward), without fighting user clicks.
  useEffect(() => {
    if (!stationParam || !radios.length) return;
    const exists = radios.some((r) => r.id === stationParam);
    if (!exists) return;
    setSelectedRadioId((prev) => (prev === stationParam ? prev : stationParam));
  }, [stationParam, radios]);

  useEffect(() => {
    if (!selectedRadioId) return;
    const cachedQueue = queueCache[selectedRadioId];
    if (cachedQueue) {
      setQueueState(cachedQueue);
      setDraftStackIds(
        draftCache[selectedRadioId] ||
          cachedQueue.upcoming.map((row) => row.stackId),
      );
      setOriginalStackIds(
        originalCache[selectedRadioId] ||
          cachedQueue.upcoming.map((row) => row.stackId),
      );
      setLoading(false);
      // Background refresh once per station switch; do not couple effect to cache updates.
      void loadQueue(selectedRadioId, false);
    } else {
      void loadQueue(selectedRadioId, true);
    }
    void loadCandidates(selectedRadioId);
  }, [selectedRadioId, loadQueue, loadCandidates]);

  useEffect(() => {
    if (!selectedRadioId) return;
    const currentStation = searchParams.get('station')?.trim() || '';
    if (currentStation === selectedRadioId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set('station', selectedRadioId);
    const nextUrl = `${pathname}?${next.toString()}`;
    router.replace(nextUrl, { scroll: false });
  }, [selectedRadioId, pathname, router, searchParams]);

  useEffect(() => {
    if (!radios.length) return;
    const others = radios
      .map((r) => r.id)
      .filter((id) => id !== selectedRadioId && !queueCache[id]);
    if (!others.length) return;
    void Promise.all(others.map((id) => loadQueue(id, false)));
  }, [radios, selectedRadioId, queueCache, loadQueue]);

  useEffect(() => {
    if (!selectedRadioId) return;
    setDraftCache((prev) => ({ ...prev, [selectedRadioId]: draftStackIds }));
  }, [selectedRadioId, draftStackIds]);

  const queueMap = useMemo(() => {
    const map = new Map<string, QueueEntry>();
    for (const row of queueState?.upcoming || []) {
      map.set(row.stackId, row);
    }
    return map;
  }, [queueState]);

  const allCandidates = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...songCandidates, ...fallbackCandidates].filter((item) => {
      if (seen.has(item.stackId)) return false;
      seen.add(item.stackId);
      return true;
    });
    return merged;
  }, [songCandidates, fallbackCandidates]);

  const draftRows = useMemo(
    () =>
      draftStackIds.map((stackId, index) => {
        const row = queueMap.get(stackId);
        return {
          position: index,
          stackId,
          title: row?.title || stackId,
          artistName: row?.artistName || null,
          source: row?.source || (stackId.startsWith('song:') ? 'songs' : 'admin_fallback'),
          durationSeconds: row?.durationSeconds || 0,
        };
      }),
    [draftStackIds, queueMap],
  );

  const hasChanges =
    draftStackIds.length !== originalStackIds.length ||
    draftStackIds.some((value, idx) => value !== originalStackIds[idx]);

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftStackIds.length) return;
    const next = [...draftStackIds];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setDraftStackIds(next);
  };

  const removeRow = (index: number) => {
    const next = [...draftStackIds];
    next.splice(index, 1);
    setDraftStackIds(next);
  };

  const addSelected = () => {
    if (!selectedAddStackId) return;
    setDraftStackIds((prev) => [...prev, selectedAddStackId]);
  };

  const saveQueue = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.replaceRadioQueue(selectedRadioId, draftStackIds);
      setOriginalStackIds(draftStackIds);
      setOriginalCache((prev) => ({ ...prev, [selectedRadioId]: draftStackIds }));
      await loadQueue(selectedRadioId);
      setSuccess('Queue updated for upcoming tracks.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save queue'));
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
    const original = originalCache[selectedRadioId] || originalStackIds;
    setDraftStackIds(original);
    setSuccess(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Queue Manager</h2>
          <p className="text-sm text-muted-foreground">
            Manage upcoming queue only. Current song keeps playing.
          </p>
        </div>
        <div className="w-full">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Stations</label>
          <div className="flex flex-wrap gap-2">
            {radios.map((radio) => (
              <button
                key={radio.id}
                type="button"
                onClick={() => setSelectedRadioId(radio.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  selectedRadioId === radio.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
                title={radio.id}
              >
                {radio.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      )}

      <Card className="p-4">
        <h3 className="font-semibold">Now Playing</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {queueState?.currentSong?.title
            ? `${queueState.currentSong.title} - ${queueState.currentSong.artistName || 'Unknown Artist'}`
            : 'No active track'}
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Add Eligible Song
            </label>
            <select
              value={selectedAddStackId}
              onChange={(e) => setSelectedAddStackId(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {allCandidates.map((candidate) => (
                <option key={candidate.stackId} value={candidate.stackId}>
                  {candidate.title} - {candidate.artistName} [{candidate.source}]
                </option>
              ))}
            </select>
          </div>
          <Button onClick={addSelected} disabled={!selectedAddStackId}>
            Add to Draft Queue
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Upcoming Queue (Draft)</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetDraft} disabled={!hasChanges || saving}>
              Reset
            </Button>
            <Button onClick={saveQueue} disabled={!hasChanges || saving || loading}>
              {saving ? 'Saving...' : 'Apply Queue Changes'}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading queue...</p>
        ) : draftRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming entries.</p>
        ) : (
          <div className="space-y-2">
            {draftRows.map((entry, idx) => (
              <div
                key={`${entry.stackId}-${idx}`}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="w-10 text-sm text-muted-foreground">#{idx + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.artistName || 'Unknown Artist'} - {entry.source} -{' '}
                    {fmtDuration(entry.durationSeconds)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moveRow(idx, -1)}
                    disabled={idx === 0}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moveRow(idx, 1)}
                    disabled={idx === draftRows.length - 1}
                  >
                    Down
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeRow(idx)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
