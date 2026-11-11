'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { proRadioPlaylistsApi, type ProRadioPlaylistTrack } from '@/lib/api';
import type { PlaybackTrack } from '@/components/playback';
import { RadioCaptureDialog } from '@/components/radio/RadioCapture';
import { loadAudioBuffer } from '@/lib/social-share';

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ProRadioVideoMaker({
  nowPlaying,
  focusToken = 0,
}: {
  focusToken?: number;
  nowPlaying?: {
    songId: string;
    title: string;
    artistName: string;
    artistId?: string | null;
    artworkUrl?: string | null;
    audioUrl: string;
    durationSeconds: number;
    positionSeconds: number;
  } | null;
}) {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<ProRadioPlaylistTrack[]>([]);
  const [searching, setSearching] = useState(true);
  const [song, setSong] = useState<ProRadioPlaylistTrack | null>(null);
  const [start, setStart] = useState(0);
  const [opening, setOpening] = useState(false);
  const [session, setSession] = useState<{
    track: PlaybackTrack;
    stream: MediaStream;
    buffer: AudioBuffer;
    offsetSeconds: number;
  } | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void proRadioPlaylistsApi
        .searchCatalog(query)
        .then((res) => setSongs(res.data?.songs ?? []))
        .catch(() => setSongs([]))
        .finally(() => setSearching(false));
    }, 300);
    setSearching(true);
    return () => window.clearTimeout(handle);
  }, [query]);

  const choose = (next: ProRadioPlaylistTrack, at = 0) => {
    if (!(next.streamUrl ?? '').trim()) {
      toast.error('That song is not available as a full Pro-Radio track.');
      return;
    }
    previewRef.current?.pause();
    setSong(next);
    setStart(Math.max(0, at));
  };

  const useNowPlaying = () => {
    if (!nowPlaying?.audioUrl) return;
    choose(
      {
        songId: nowPlaying.songId,
        title: nowPlaying.title,
        artistName: nowPlaying.artistName,
        artistId: nowPlaying.artistId,
        artworkUrl: nowPlaying.artworkUrl,
        durationSeconds: nowPlaying.durationSeconds,
        streamUrl: nowPlaying.audioUrl,
      },
      nowPlaying.positionSeconds,
    );
  };

  useEffect(() => {
    if (focusToken > 0) useNowPlaying();
    // The token is the only trigger; nowPlaying is read at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const span =
    song && (song.durationSeconds ?? 0) > 1 ? (song.durationSeconds ?? 1) - 1 : 240;

  const preview = () => {
    const audio = previewRef.current;
    const url = song?.streamUrl?.trim();
    if (!audio || !url) return;
    if (!audio.paused && audio.src === url) {
      audio.pause();
      return;
    }
    audio.src = url;
    audio.currentTime = start;
    void audio.play().catch(() => {
      toast.error('Could not preview that part of the song.');
    });
  };

  const record = async () => {
    const url = song?.streamUrl?.trim();
    if (!song || !url || opening) return;
    previewRef.current?.pause();
    setOpening(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      const buffer = await loadAudioBuffer(url);
      const track: PlaybackTrack = {
        id: song.songId,
        title: song.title,
        artistName: song.artistName ?? '',
        artistId: song.artistId ?? null,
        artworkUrl: song.artworkUrl ?? null,
        audioUrl: url,
        durationSeconds: song.durationSeconds ?? 0,
      };
      setSession({
        track,
        stream,
        buffer,
        offsetSeconds: start,
      });
    } catch (error) {
      stream?.getTracks().forEach((item) => item.stop());
      toast.error(
        error instanceof Error ? error.message : 'Allow camera access to record.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Make a video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Pick any Pro-Radio song and the moment to start. The clip uses the full track, not a Discover clip, a sample, or the live station.
        </p>
        {nowPlaying?.audioUrl ? (
          <Button type="button" variant="outline" size="sm" onClick={useNowPlaying}>
            Use the song that is playing ({clock(nowPlaying.positionSeconds)})
          </Button>
        ) : null}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search songs or artists"
        />
        <div className="max-h-48 overflow-y-auto space-y-1">
          {searching ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : songs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pro-Radio songs matched.</p>
          ) : (
            songs.map((item) => (
              <button
                key={item.songId}
                type="button"
                onClick={() => choose(item)}
                className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-muted/50 ${
                  song?.songId === item.songId ? 'bg-muted' : ''
                }`}
              >
                <span className="block text-sm font-medium truncate">{item.title}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {item.artistName ?? 'Artist'}
                  {(item.durationSeconds ?? 0) > 0 ? ` · ${clock(item.durationSeconds ?? 0)}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
        {song ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">
              {song.title}
              {song.artistName ? ` — ${song.artistName}` : ''}
            </p>
            <label className="block text-xs text-muted-foreground">
              Start at {clock(start)} · 15 seconds of the song
              <input
                type="range"
                min={0}
                max={span}
                step={1}
                value={Math.min(start, span)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setStart(next);
                  const audio = previewRef.current;
                  if (audio && !audio.paused) audio.currentTime = next;
                }}
                className="mt-2 w-full"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={preview}>
                Preview
              </Button>
              <Button type="button" size="sm" onClick={() => void record()} disabled={opening}>
                {opening ? 'Opening…' : 'Record'}
              </Button>
            </div>
            <audio ref={previewRef} className="hidden" />
          </div>
        ) : null}
        {session ? (
          <RadioCaptureDialog
            track={session.track}
            stream={session.stream}
            buffer={session.buffer}
            offsetSeconds={session.offsetSeconds}
            durationSeconds={session.track.durationSeconds}
            onClose={() => setSession(null)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
