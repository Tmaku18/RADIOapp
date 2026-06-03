'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
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
      let s = Math.max(0, Math.min(Math.round(nextStart), upperStart));

      let e = Math.round(nextEnd);
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
            className="absolute top-0 h-full rounded-md bg-primary/30"
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
          <label className="text-xs text-muted-foreground">
            Start time (m:ss)
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
              disabled={disabled}
              onClick={() => nudgeStart(-1)}
              title="Nudge start back 1 second"
            >
              -1s
            </Button>
            <input
              type="text"
              inputMode="numeric"
              value={startText}
              disabled={disabled}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={commitStartText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitStartText();
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
              disabled={disabled}
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
              disabled={disabled}
              onClick={() => nudgeEnd(-1)}
              title="Nudge end back 1 second"
            >
              -1s
            </Button>
            <input
              type="text"
              inputMode="numeric"
              value={endText}
              disabled={disabled}
              onChange={(e) => setEndText(e.target.value)}
              onBlur={commitEndText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEndText();
              }}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-center text-sm font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-2"
              disabled={disabled}
              onClick={() => nudgeEnd(1)}
              title="Nudge end forward 1 second"
            >
              +1s
            </Button>
          </div>
        </div>
      </div>

      {audioUrl && (
        <>
          <div>
            <label className="text-xs text-muted-foreground">
              Drag start ({fmt(startSeconds)})
            </label>
            <input
              type="range"
              min={0}
              max={maxStart}
              step={1}
              value={startSeconds}
              disabled={disabled}
              onChange={(e) =>
                applyWindow(Number(e.target.value), endSeconds, {
                  keepLength: true,
                })
              }
              className="w-full"
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
              {playing ? 'Pause' : `Preview ${Math.round(sampleLength)}s`}
            </Button>
            <span className="text-xs font-mono text-muted-foreground">
              {fmt(current)} / {fmt(total)}
            </span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              Length {Math.round(sampleLength)}s
            </span>
          </div>
        </>
      )}
    </div>
  );
}
