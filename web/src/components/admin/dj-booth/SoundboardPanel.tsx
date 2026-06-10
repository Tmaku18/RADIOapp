'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { djBoothApi } from '@/lib/api';

export type SoundboardClip = {
  id: string;
  name: string;
  durationSeconds: number;
  clipUrl: string;
  createdAt?: string;
};

type Props = {
  stationId: string;
  clips: SoundboardClip[];
  onRefresh: () => void;
};

export function SoundboardPanel({ stationId, clips, onRefresh }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadClip = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const res = await djBoothApi.createSoundboardUploadUrl(file.name, file.type || 'audio/mpeg');
      const { path, signedUrl } = res.data as {
        path: string;
        token: string;
        signedUrl: string;
      };
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      let durationSeconds = 5;
      try {
        durationSeconds = await new Promise<number>((resolve) => {
          const audio = new Audio(URL.createObjectURL(file));
          audio.addEventListener('loadedmetadata', () => {
            resolve(Math.min(30, Math.max(1, Math.ceil(audio.duration || 5))));
          });
          audio.addEventListener('error', () => resolve(5));
        });
      } catch {
        durationSeconds = 5;
      }

      await djBoothApi.registerSoundboardClip({
        name: uploadName.trim() || file.name.replace(/\.[^.]+$/, ''),
        storagePath: path,
        durationSeconds,
      });
      setUploadName('');
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const playClip = async (clipId: string) => {
    setBusy(true);
    try {
      await djBoothApi.playSoundboardClip(stationId, clipId);
    } finally {
      setBusy(false);
    }
  };

  const deleteClip = async (clipId: string) => {
    setBusy(true);
    try {
      await djBoothApi.deleteSoundboardClip(clipId);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-lg">Soundboard</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2 items-end">
        <Input
          placeholder="Clip name"
          value={uploadName}
          onChange={(e) => setUploadName(e.target.value)}
          className="max-w-xs"
        />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadClip(file);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Upload clip
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {clips.map((clip) => (
          <div key={clip.id} className="border rounded-lg p-2 flex flex-col gap-2">
            <span className="text-sm font-medium truncate" title={clip.name}>
              {clip.name}
            </span>
            <span className="text-xs text-muted-foreground">{clip.durationSeconds}s</span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => playClip(clip.id)}
              >
                Play
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => deleteClip(clip.id)}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}
        {clips.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No clips yet. Upload short audio stingers.</p>
        )}
      </div>
    </Card>
  );
}
