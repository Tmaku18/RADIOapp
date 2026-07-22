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
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { songsApi } from '@/lib/api';
import { bindExclusivePreview } from '@/lib/preview-audio';

const MAX_SAMPLE = 30;
const MIN_SAMPLE = 5;
const STEP = 0.5;

/** Round to the nearest half-second. */
function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Format seconds as m:ss, appending .5 for half-second values. */
function fmt(seconds: number): string {
  const r = Math.max(0, roundHalf(seconds));
  const m = Math.floor(r / 60);
  const rem = r - m * 60;
  const whole = Math.floor(rem);
  const ss = whole.toString().padStart(2, '0');
  return rem - whole >= 0.5 ? `${m}:${ss}.5` : `${m}:${ss}`;
}

/** Format a duration in seconds, showing .5 when fractional (e.g. "12.5s"). */
function fmtLen(seconds: number): string {
  return `${roundHalf(Math.max(0, seconds))}s`;
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
    sampleUrl?: string | null;
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
  const playback = usePlaybackOptional();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const didSoftPauseRadioRef = useRef(false);
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

  const softPauseRadio = useCallback(() => {
    if (!playback?.actions || didSoftPauseRadioRef.current) return;
    playback.actions.softPause();
    didSoftPauseRadioRef.current = true;
  }, [playback]);

  const softResumeRadioIfNeeded = useCallback(() => {
    if (!playback?.actions || !didSoftPauseRadioRef.current) return;
    didSoftPauseRadioRef.current = false;
    void playback.actions.softResume();
  }, [playback]);

  const maxStart = Math.max(0, (duration || MAX_SAMPLE) - MIN_SAMPLE);
  const total = duration || end || start + MAX_SAMPLE;
  const alreadySet =
    !!song?.sampleUrl || song?.sampleStartSeconds != null;

  /** Clamp the start/end pair so the window stays 5–30s and inside the track. */
  const applyWindow = useCallback(
    (nextStart: number, nextEnd: number, opts?: { keepLength?: boolean }) => {
      const dur = duration || 0;
      const upperStart = dur > 0 ? Math.max(0, dur - MIN_SAMPLE) : Infinity;
      let s = Math.max(0, Math.min(roundHalf(nextStart), upperStart));

      let e = roundHalf(nextEnd);
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
    // Pause this preview when another clip/sample preview starts (and vice versa).
    const onPlayPause = () => setPlaying(!audio.paused && !audio.ended);
    const unbindExclusive = bindExclusivePreview(audio);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlayPause);
    audio.addEventListener('pause', onPlayPause);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlayPause);
      audio.removeEventListener('pause', onPlayPause);
      unbindExclusive();
      audio.pause();
      audioRef.current = null;
      softResumeRadioIfNeeded();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, song?.audioUrl, softResumeRadioIfNeeded]);

  const previewWindow = () => {
    const audio = audioRef.current;
    if (!audio) return;
    softPauseRadio();
    audio.loop = false;
    audio.currentTime = start;
    void audio.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
    softResumeRadioIfNeeded();
  };

  const nudgeStart = (delta: number) => {
    applyWindow(start + delta, end, { keepLength: true });
  };

  const nudgeEnd = (delta: number) => {
    applyWindow(start, end + delta);
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
        roundHalf(start),
        roundHalf(end),
      );
      toast.success('Sample updated');
      onSaved?.({
        sampleUrl: res.data?.sampleUrl ?? null,
        sampleStartSeconds: res.data?.sampleStartSeconds ?? roundHalf(start),
        sampleEndSeconds: res.data?.sampleEndSeconds ?? roundHalf(end),
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
          <DialogTitle>{alreadySet ? 'Edit preview sample' : 'Set preview sample'}</DialogTitle>
          <DialogDescription>
            Choose the {MIN_SAMPLE}–{MAX_SAMPLE}s window listeners hear on your
            artist page until they buy the song. Each song has one sample.
          </DialogDescription>
        </DialogHeader>

        {alreadySet && song?.audioUrl && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            A sample is already set ({fmt(song.sampleStartSeconds ?? start)}–
            {fmt(song.sampleEndSeconds ?? end)}). Saving will overwrite the
            existing sample.
          </div>
        )}

        {!song?.audioUrl ? (
          <p className="text-sm text-muted-foreground">
            This song has no audio source to sample.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Visual track with highlighted sample window */}
            <div className="relative h-10 w-full rounded-md bg-muted">
              <div
                className="absolute top-0 h-full rounded-md bg-green-500/30"
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
                <label className="text-xs font-medium text-green-600 dark:text-green-400">
                  Start time (m:ss)
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2 border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400"
                    onClick={() => nudgeStart(-STEP)}
                    title="Nudge start back 0.5 second"
                  >
                    -0.5s
                  </Button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                    onBlur={commitStartText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitStartText();
                    }}
                    className="w-full rounded-md border border-green-500/50 bg-background px-2 py-1 text-center text-sm font-mono font-semibold text-green-600 dark:text-green-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2 border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400"
                    onClick={() => nudgeStart(STEP)}
                    title="Nudge start forward 0.5 second"
                  >
                    +0.5s
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-red-600 dark:text-red-400">
                  End time (m:ss)
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2 border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                    onClick={() => nudgeEnd(-STEP)}
                    title="Nudge end back 0.5 second"
                  >
                    -0.5s
                  </Button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={endText}
                    onChange={(e) => setEndText(e.target.value)}
                    onBlur={commitEndText}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEndText();
                    }}
                    className="w-full rounded-md border border-red-500/50 bg-background px-2 py-1 text-center text-sm font-mono font-semibold text-red-600 dark:text-red-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="px-2 border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                    onClick={() => nudgeEnd(STEP)}
                    title="Nudge end forward 0.5 second"
                  >
                    +0.5s
                  </Button>
                </div>
              </div>
            </div>

            {/* Coarse start scrubber */}
            <div>
              <label className="text-xs font-medium text-green-600 dark:text-green-400">
                Drag start ({fmt(start)})
              </label>
              <input
                type="range"
                min={0}
                max={maxStart}
                step={STEP}
                value={start}
                onChange={(e) => applyWindow(Number(e.target.value), end, { keepLength: true })}
                className="w-full accent-green-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (playing ? pause() : previewWindow())}
              >
                {playing ? 'Pause' : `Preview ${fmtLen(sampleLength)}`}
              </Button>
              <span className="text-xs font-mono text-muted-foreground">
                {fmt(current)} / {fmt(total)}
              </span>
              <span className="ml-auto text-xs font-mono text-muted-foreground">
                Length {fmtLen(sampleLength)}
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
                {saving
                  ? 'Saving…'
                  : alreadySet
                    ? 'Overwrite sample'
                    : 'Save sample'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
