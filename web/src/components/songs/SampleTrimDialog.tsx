'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { songsApi } from '@/lib/api';

const MAX_SAMPLE = 30;
const MIN_SAMPLE = 5;

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Parse "m:ss" or a plain seconds string into seconds. Returns null if invalid. */
function parseTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const [mm, ss] = trimmed.split(':');
    const m = Number(mm);
    const s = Number(ss);
    if (!Number.isFinite(m) || !Number.isFinite(s) || s < 0 || s >= 60) {
      return null;
    }
    return m * 60 + s;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: {
    id: string;
    title: string;
    /** Full-track URL used to preview/select the sample window. */
    audioUrl: string | null;
    durationSeconds?: number | null;
    sampleStartSeconds?: number | null;
    sampleEndSeconds?: number | null;
  } | null;
  onSaved?: (result: {
    sampleUrl: string | null;
    sampleStartSeconds: number;
    sampleEndSeconds: number;
  }) => void;
};

/**
 * Pick the preview sample window (5–30s) for a song. The uploader/admin scrubs
 * the full track, sets start/end points, previews the looping window, and saves.
 * The server renders the actual sample file.
 */
export function SampleTrimDialog({ open, onOpenChange, song, onSaved }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number>(song?.durationSeconds ?? 0);
  const [start, setStart] = useState<number>(song?.sampleStartSeconds ?? 0);
  const [end, setEnd] = useState<number>(
    song?.sampleEndSeconds ?? (song?.sampleStartSeconds ?? 0) + MAX_SAMPLE,
  );
  const [current, setCurrent] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  // Raw text in the inputs so the user can type freely before we clamp.
  const [startText, setStartText] = useState('0:00');
  const [endText, setEndText] = useState('0:30');

  // Refs keep the looping preview in sync without recreating the audio element.
  const startRef = useRef(start);
  const endRef = useRef(end);
  startRef.current = start;
  endRef.current = end;

  const maxStart = Math.max(0, (duration || MAX_SAMPLE) - MIN_SAMPLE);
  const total = duration || end || start + MAX_SAMPLE;

  /** Clamp the start/end pair so the window stays 5–30s and inside the track. */
  const applyWindow = useCallback(
    (nextStart: number, nextEnd: number, opts?: { keepLength?: boolean }) => {
      const dur = duration || 0;
      const upperStart = dur > 0 ? Math.max(0, dur - MIN_SAMPLE) : Infinity;
      let s = Math.max(0, Math.min(Math.round(nextStart), upperStart));

      let e = Math.round(nextEnd);
      if (opts?.keepLength) {
        const length = Math.min(MAX_SAMPLE, Math.max(MIN_SAMPLE, endRef.current - startRef.current));
        e = s + length;
      }
      // Enforce 5–30s window length.
      if (e < s + MIN_SAMPLE) e = s + MIN_SAMPLE;
      if (e > s + MAX_SAMPLE) e = s + MAX_SAMPLE;
      // Keep inside the track; if it overflows, pull the window back.
      if (dur > 0 && e > dur) {
        e = dur;
        if (e - s < MIN_SAMPLE) s = Math.max(0, e - MIN_SAMPLE);
        if (e - s > MAX_SAMPLE) s = e - MAX_SAMPLE;
      }
      setStart(s);
      setEnd(e);
      setStartText(fmt(s));
      setEndText(fmt(e));
      if (audioRef.current) audioRef.current.currentTime = s;
      return { s, e };
    },
    [duration],
  );

  useEffect(() => {
    if (!open) return;
    const s = song?.sampleStartSeconds ?? 0;
    const e =
      song?.sampleEndSeconds && song.sampleEndSeconds > s
        ? song.sampleEndSeconds
        : s + MAX_SAMPLE;
    setStart(s);
    setEnd(e);
    setStartText(fmt(s));
    setEndText(fmt(e));
    setDuration(song?.durationSeconds ?? 0);
    setCurrent(0);
    setPlaying(false);
  }, [
    open,
    song?.id,
    song?.durationSeconds,
    song?.sampleStartSeconds,
    song?.sampleEndSeconds,
  ]);

  useEffect(() => {
    if (!open || !song?.audioUrl) return;
    const audio = new Audio(song.audioUrl);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration((prev) => prev || Math.floor(audio.duration));
      }
    };
    const onTime = () => {
      setCurrent(audio.currentTime);
      // Loop within the selected window while previewing.
      if (
        audio.currentTime >= endRef.current ||
        audio.currentTime < startRef.current - 0.25
      ) {
        audio.currentTime = startRef.current;
      }
    };
    const onEnded = () => setPlaying(false);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, song?.audioUrl]);

  const previewWindow = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = false;
    audio.currentTime = start;
    void audio.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const nudgeStart = (delta: number) => {
    applyWindow(start + delta, end, { keepLength: true });
  };

  const commitStartText = () => {
    const parsed = parseTime(startText);
    if (parsed == null) {
      setStartText(fmt(start));
      return;
    }
    applyWindow(parsed, end, { keepLength: true });
  };

  const commitEndText = () => {
    const parsed = parseTime(endText);
    if (parsed == null) {
      setEndText(fmt(end));
      return;
    }
    applyWindow(start, parsed);
  };

  const sampleLength = Math.max(0, end - start);

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      const res = await songsApi.setSample(
        song.id,
        Math.round(start),
        Math.round(end),
      );
      toast.success('Sample updated');
      onSaved?.({
        sampleUrl: res.data?.sampleUrl ?? null,
        sampleStartSeconds: res.data?.sampleStartSeconds ?? Math.round(start),
        sampleEndSeconds: res.data?.sampleEndSeconds ?? Math.round(end),
      });
      onOpenChange(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not save sample. Try again.';
      toast.error(typeof msg === 'string' ? msg : 'Could not save sample.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) pause();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set preview sample</DialogTitle>
          <DialogDescription>
            Choose the {MIN_SAMPLE}–{MAX_SAMPLE}s window listeners hear on your
            artist page until they buy the song.
          </DialogDescription>
        </DialogHeader>

        {!song?.audioUrl ? (
          <p className="text-sm text-muted-foreground">
            This song has no audio source to sample.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Visual track with highlighted sample window */}
            <div className="relative h-10 w-full rounded-md bg-muted">
              <div
                className="absolute top-0 h-full rounded-md bg-primary/30"
                style={{
                  left: `${(start / total) * 100}%`,
                  width: `${(Math.min(sampleLength, total) / total) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground"
                style={{ left: `${(current / total) * 100}%` }}
              />
            </div>

            {/* Fine-tuning: start / end text inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Start time (m:ss)
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => nudgeStart(-1)}
                    title="Nudge start back 1 second"
                  >
                    -1s
                  </Button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                    onBlur={commitStartText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitStartText();
                    }}
                    className="w-full rounded-md border bg-background px-2 py-1 text-center text-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => nudgeStart(1)}
                    title="Nudge start forward 1 second"
                  >
                    +1s
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  End time (m:ss)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={endText}
                  onChange={(e) => setEndText(e.target.value)}
                  onBlur={commitEndText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEndText();
                  }}
                  className="w-full rounded-md border bg-background px-2 py-1 text-center text-sm font-mono"
                />
              </div>
            </div>

            {/* Coarse start scrubber */}
            <div>
              <label className="text-xs text-muted-foreground">
                Drag start ({fmt(start)})
              </label>
              <input
                type="range"
                min={0}
                max={maxStart}
                step={1}
                value={start}
                onChange={(e) => applyWindow(Number(e.target.value), end, { keepLength: true })}
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (playing ? pause() : previewWindow())}
              >
                {playing ? 'Pause' : `Preview ${Math.round(sampleLength)}s`}
              </Button>
              <span className="text-xs font-mono text-muted-foreground">
                {fmt(current)} / {fmt(total)}
              </span>
              <span className="ml-auto text-xs font-mono text-muted-foreground">
                Length {Math.round(sampleLength)}s
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  pause();
                  onOpenChange(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save sample'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
