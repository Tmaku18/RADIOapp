'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { bindExclusivePreview } from '@/lib/preview-audio';

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

/** Parse "m:ss" or a plain seconds string into seconds. Null if invalid. */
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
  /** Audio source to scrub/preview. When null, only the numeric controls show. */
  audioUrl: string | null;
  durationSeconds?: number | null;
  startSeconds: number;
  endSeconds: number;
  /** Reports the clamped window back to the parent. */
  onChange: (startSeconds: number, endSeconds: number) => void;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
};

/**
 * Inline window picker for trimming a clip from a track: start/end time inputs,
 * ±1s nudge buttons, a coarse start scrubber, and a looping preview of just the
 * selected window. The window length is clamped between `minLength`–`maxLength`.
 */
export function ClipWindowEditor({
  audioUrl,
  durationSeconds,
  startSeconds,
  endSeconds,
  onChange,
  minLength = 5,
  maxLength = 15,
  disabled = false,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number>(durationSeconds ?? 0);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [startText, setStartText] = useState(fmt(startSeconds));
  const [endText, setEndText] = useState(fmt(endSeconds));

  const startRef = useRef(startSeconds);
  const endRef = useRef(endSeconds);
  startRef.current = startSeconds;
  endRef.current = endSeconds;

  useEffect(() => {
    setStartText(fmt(startSeconds));
  }, [startSeconds]);
  useEffect(() => {
    setEndText(fmt(endSeconds));
  }, [endSeconds]);
  useEffect(() => {
    setDuration(durationSeconds ?? 0);
  }, [durationSeconds]);

  const sampleLength = Math.max(0, endSeconds - startSeconds);
  const maxStart = Math.max(0, (duration || maxLength) - minLength);
  const total = duration || endSeconds || startSeconds + maxLength;

  /** Clamp the start/end pair so the window stays min–max and inside the track. */
  const applyWindow = useCallback(
    (nextStart: number, nextEnd: number, opts?: { keepLength?: boolean }) => {
      const dur = duration || 0;
      const upperStart = dur > 0 ? Math.max(0, dur - minLength) : Infinity;
      let s = Math.max(0, Math.min(roundHalf(nextStart), upperStart));

      let e = roundHalf(nextEnd);
      if (opts?.keepLength) {
        const length = Math.min(
          maxLength,
          Math.max(minLength, endRef.current - startRef.current),
        );
        e = s + length;
      }
      if (e < s + minLength) e = s + minLength;
      if (e > s + maxLength) e = s + maxLength;
      if (dur > 0 && e > dur) {
        e = dur;
        if (e - s < minLength) s = Math.max(0, e - minLength);
        if (e - s > maxLength) s = e - maxLength;
      }
      if (audioRef.current) audioRef.current.currentTime = s;
      onChange(s, e);
    },
    [duration, minLength, maxLength, onChange],
  );

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration((prev) => prev || Math.floor(audio.duration));
      }
    };
    const onTime = () => {
      setCurrent(audio.currentTime);
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
    };
  }, [audioUrl]);

  const previewWindow = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = false;
    audio.currentTime = startSeconds;
    void audio.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const nudgeStart = (delta: number) => {
    pause();
    applyWindow(startSeconds + delta, endSeconds, { keepLength: true });
  };

  const nudgeEnd = (delta: number) => {
    pause();
    applyWindow(startSeconds, endSeconds + delta);
  };

  const commitStartText = () => {
    const parsed = parseTime(startText);
    if (parsed == null) {
      setStartText(fmt(startSeconds));
      return;
    }
    applyWindow(parsed, endSeconds, { keepLength: true });
  };

  const commitEndText = () => {
    const parsed = parseTime(endText);
    if (parsed == null) {
      setEndText(fmt(endSeconds));
      return;
    }
    applyWindow(startSeconds, parsed);
  };

  return (
    <div className="space-y-3">
      {audioUrl && (
        <div className="relative h-8 w-full rounded-md bg-muted">
          <div
            className="absolute top-0 h-full rounded-md bg-green-500/30"
            style={{
              left: `${(startSeconds / total) * 100}%`,
              width: `${(Math.min(sampleLength, total) / total) * 100}%`,
            }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground"
            style={{ left: `${(current / total) * 100}%` }}
          />
        </div>
      )}

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
              disabled={disabled}
              onClick={() => nudgeStart(-STEP)}
              title="Nudge start back 0.5 second"
            >
              -0.5s
            </Button>
            <input
              type="text"
              inputMode="decimal"
              value={startText}
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
              onClick={() => nudgeEnd(-STEP)}
              title="Nudge end back 0.5 second"
            >
              -0.5s
            </Button>
            <input
              type="text"
              inputMode="decimal"
              value={endText}
              disabled={disabled}
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
              disabled={disabled}
              onClick={() => nudgeEnd(STEP)}
              title="Nudge end forward 0.5 second"
            >
              +0.5s
            </Button>
          </div>
        </div>
      </div>

      {audioUrl && (
        <>
          <div>
            <label className="text-xs font-medium text-green-600 dark:text-green-400">
              Drag start ({fmt(startSeconds)})
            </label>
            <input
              type="range"
              min={0}
              max={maxStart}
              step={STEP}
              value={startSeconds}
              disabled={disabled}
              onChange={(e) =>
                applyWindow(Number(e.target.value), endSeconds, {
                  keepLength: true,
                })
              }
              className="w-full accent-green-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
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
        </>
      )}
    </div>
  );
}
