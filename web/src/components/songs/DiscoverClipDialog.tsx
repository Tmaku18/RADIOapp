'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipWindowEditor } from '@/components/songs/ClipWindowEditor';
import { songsApi } from '@/lib/api';

const MIN_LEN = 5;
const MAX_LEN = 15;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: {
    id: string;
    title: string;
    /** Full-track URL used to preview/select the clip window. */
    audioUrl: string | null;
    durationSeconds?: number | null;
    discoverClipStartSeconds?: number | null;
    discoverClipEndSeconds?: number | null;
  } | null;
  onSaved?: (result: {
    discoverEnabled: boolean;
    discoverClipUrl: string | null;
    discoverClipStartSeconds: number;
    discoverClipEndSeconds: number;
  }) => void;
};

/**
 * Pick the Discover swipe clip (5–15s) for a song, trimmed from its own audio.
 * Mirrors the sample trimmer UX: start/end inputs, ±1s nudge, looping preview.
 * The server renders the clip and enables Discover on save.
 */
export function DiscoverClipDialog({ open, onOpenChange, song, onSaved }: Props) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(MAX_LEN);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = song?.discoverClipStartSeconds ?? 0;
    const e =
      song?.discoverClipEndSeconds && song.discoverClipEndSeconds > s
        ? song.discoverClipEndSeconds
        : s + MAX_LEN;
    setStart(s);
    setEnd(e);
  }, [open, song?.id, song?.discoverClipStartSeconds, song?.discoverClipEndSeconds]);

  const handleSave = async () => {
    if (!song) return;
    setSaving(true);
    try {
      const res = await songsApi.publishDiscoverFromLibrary(song.id, {
        clipStartSeconds: Math.round(start),
        clipEndSeconds: Math.round(end),
      });
      const data = (res.data ?? {}) as {
        discoverEnabled?: boolean;
        discoverClipUrl?: string | null;
        discoverClipStartSeconds?: number | null;
        discoverClipEndSeconds?: number | null;
      };
      toast.success('Discover clip saved');
      onSaved?.({
        discoverEnabled: data.discoverEnabled ?? true,
        discoverClipUrl: data.discoverClipUrl ?? null,
        discoverClipStartSeconds:
          data.discoverClipStartSeconds ?? Math.round(start),
        discoverClipEndSeconds: data.discoverClipEndSeconds ?? Math.round(end),
      });
      onOpenChange(false);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not save Discover clip. Try again.';
      toast.error(typeof msg === 'string' ? msg : 'Could not save Discover clip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Discover clip</DialogTitle>
          <DialogDescription>
            Choose the {MIN_LEN}–{MAX_LEN}s clip from this track for the Discover
            swipe feed. Preview the looping window, then publish.
          </DialogDescription>
        </DialogHeader>

        {!song?.audioUrl ? (
          <p className="text-sm text-muted-foreground">
            This song has no audio source to clip.
          </p>
        ) : (
          <div className="space-y-4">
            <ClipWindowEditor
              audioUrl={song.audioUrl}
              durationSeconds={song.durationSeconds ?? null}
              minLength={MIN_LEN}
              maxLength={MAX_LEN}
              startSeconds={start}
              endSeconds={end}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Publish to Discover'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
