'use client';

import { useEffect, useRef, useState } from 'react';
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

const SAMPLE_LENGTH = 30;

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
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
  } | null;
  onSaved?: (result: {
    sampleUrl: string | null;
    sampleStartSeconds: number;
    sampleEndSeconds: number;
  }) => void;
};

/**
 * Pick the 30-second preview sample for a song. The uploader/admin scrubs the
 * full track, sets a start point, previews the window, and saves. The server
 * renders the actual sample file.
 */
export function SampleTrimDialog({ open, onOpenChange, song, onSaved }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState<number>(song?.durationSeconds ?? 0);
  const [start, setStart] = useState<number>(song?.sampleStartSeconds ?? 0);
  const [current, setCurrent] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  const end = Math.min(start + SAMPLE_LENGTH, duration || start + SAMPLE_LENGTH);
  const maxStart = Math.max(0, (duration || SAMPLE_LENGTH) - SAMPLE_LENGTH);

  useEffect(() => {
    if (!open) return;
    setStart(song?.sampleStartSeconds ?? 0);
    setDuration(song?.durationSeconds ?? 0);
    setCurrent(0);
    setPlaying(false);
  }, [open, song?.id, song?.durationSeconds, song?.sampleStartSeconds]);

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
      // Loop within the selected sample window while previewing.
      if (audio.currentTime >= start + SAMPLE_LENGTH || audio.currentTime < start) {
        audio.currentTime = start;
        if (!playing) {
          audio.pause();
        }
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
    audio.currentTime = start;
    void audio.play();
    setPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      const res = await songsApi.setSample(song.id, Math.round(start));
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

  const total = duration || start + SAMPLE_LENGTH;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) pause(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set 30-second sample</DialogTitle>
          <DialogDescription>
            Choose where the preview starts. Listeners hear this 30-second clip
            on your artist page until they buy the song.
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
                  width: `${(Math.min(SAMPLE_LENGTH, total) / total) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground"
                style={{ left: `${(current / total) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Start {fmt(start)}</span>
              <span>End {fmt(end)}</span>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Sample start ({fmt(start)})
              </label>
              <input
                type="range"
                min={0}
                max={maxStart}
                step={1}
                value={start}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStart(v);
                  if (audioRef.current) audioRef.current.currentTime = v;
                }}
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
                {playing ? 'Pause' : 'Preview 30s'}
              </Button>
              <span className="text-xs font-mono text-muted-foreground">
                {fmt(current)} / {fmt(total)}
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
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save sample'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
