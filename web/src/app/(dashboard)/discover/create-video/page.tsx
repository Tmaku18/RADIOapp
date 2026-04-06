'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { discoverAudioApi, discoveryApi, type DiscoverAudioSongCard } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RecorderState = 'idle' | 'recording' | 'recorded';

const MAX_SECONDS = 15;

function pickRecorderMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    '',
  ];
  for (const candidate of candidates) {
    if (!candidate) return candidate;
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

export default function CreateDiscoverFeedVideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();

  const initialClipUrl = searchParams.get('clipUrl') ?? '';
  const initialSongTitle = searchParams.get('title') ?? 'Discover clip';
  const initialArtistName = searchParams.get('artist') ?? '';
  const [selectedClip, setSelectedClip] = useState<{
    clipUrl: string;
    songTitle: string;
    artistName: string;
  } | null>(
    initialClipUrl
      ? {
          clipUrl: initialClipUrl,
          songTitle: initialSongTitle,
          artistName: initialArtistName,
        }
      : null,
  );
  const [likedClips, setLikedClips] = useState<
    Array<DiscoverAudioSongCard & { likedAt: string }>
  >([]);
  const [loadingLikedClips, setLoadingLikedClips] = useState(false);
  const initialCaption = useMemo(
    () =>
      `${selectedClip?.songTitle ?? 'Discover clip'}${
        selectedClip?.artistName ? ` - ${selectedClip.artistName}` : ''
      }`,
    [selectedClip],
  );

  const [state, setState] = useState<RecorderState>('idle');
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState(initialCaption);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const mixedAudioContextRef = useRef<AudioContext | null>(null);
  const mixedAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null,
  );
  const clipAudioElRef = useRef<HTMLAudioElement | null>(null);
  const clipAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const canPostToFeed =
    profile?.role === 'service_provider' || profile?.role === 'admin';

  useEffect(() => {
    if (selectedClip) return;
    setLoadingLikedClips(true);
    discoverAudioApi
      .getLikedList({ limit: 100, offset: 0 })
      .then((res) => setLikedClips(res.data.items ?? []))
      .catch((err) => {
        console.error(err);
        setError('Failed to load Discover clips. Please try again.');
      })
      .finally(() => setLoadingLikedClips(false));
  }, [selectedClip]);

  useEffect(() => {
    setCaption(initialCaption);
  }, [initialCaption]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current != null) {
        window.clearTimeout(stopTimerRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      if (clipAudioElRef.current) {
        clipAudioElRef.current.pause();
        clipAudioElRef.current.src = '';
      }
      if (clipAudioSourceRef.current) {
        clipAudioSourceRef.current.disconnect();
      }
      if (mixedAudioDestinationRef.current) {
        mixedAudioDestinationRef.current.disconnect();
      }
      if (mixedAudioContextRef.current) {
        void mixedAudioContextRef.current.close();
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [recordedUrl]);

  const clearRecordedPreview = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setRecordedFile(null);
    setState('idle');
  };

  const resetRecorderSession = () => {
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recorderChunksRef.current = [];
    if (clipAudioElRef.current) {
      clipAudioElRef.current.pause();
      clipAudioElRef.current.src = '';
      clipAudioElRef.current = null;
    }
    if (clipAudioSourceRef.current) {
      clipAudioSourceRef.current.disconnect();
      clipAudioSourceRef.current = null;
    }
    if (mixedAudioDestinationRef.current) {
      mixedAudioDestinationRef.current.disconnect();
      mixedAudioDestinationRef.current = null;
    }
    if (mixedAudioContextRef.current) {
      void mixedAudioContextRef.current.close();
      mixedAudioContextRef.current = null;
    }
  };

  const ensureCamera = async (): Promise<MediaStream> => {
    if (cameraStreamRef.current) return cameraStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });
    cameraStreamRef.current = stream;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      await previewVideoRef.current.play().catch(() => undefined);
    }
    return stream;
  };

  const startRecording = async () => {
    if (!selectedClip?.clipUrl) {
      setError('Missing clip URL. Go back and choose a Discover clip first.');
      return;
    }
    if (!canPostToFeed) {
      setError('Only Catalysts and admins can post to the full feed.');
      return;
    }
    setError(null);
    setStarting(true);
    try {
      resetRecorderSession();
      clearRecordedPreview();
      const cameraStream = await ensureCamera();
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      mixedAudioContextRef.current = audioContext;
      mixedAudioDestinationRef.current = destination;

      const micTracks = cameraStream.getAudioTracks();
      if (micTracks.length > 0) {
        const micStream = new MediaStream([micTracks[0]]);
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      const clipAudio = new Audio(selectedClip.clipUrl);
      clipAudio.crossOrigin = 'anonymous';
      clipAudio.preload = 'auto';
      clipAudio.currentTime = 0;
      clipAudioElRef.current = clipAudio;

      const clipSource = audioContext.createMediaElementSource(clipAudio);
      clipAudioSourceRef.current = clipSource;
      clipSource.connect(destination);
      clipSource.connect(audioContext.destination);

      const recordingStream = new MediaStream([
        ...cameraStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);
      recorderRef.current = recorder;
      recorderChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) recorderChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blobType =
          recorder.mimeType && recorder.mimeType.length > 0
            ? recorder.mimeType
            : 'video/webm';
        const blob = new Blob(recorderChunksRef.current, { type: blobType });
        const ext = blobType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `discover-feed-${Date.now()}.${ext}`, {
          type: blobType,
        });
        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl);
        }
        const objectUrl = URL.createObjectURL(blob);
        setRecordedUrl(objectUrl);
        setRecordedFile(file);
        setState('recorded');
      };

      await audioContext.resume();
      await clipAudio.play();
      recorder.start(250);
      setState('recording');

      clipAudio.onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };

      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, (MAX_SECONDS + 1) * 1000);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start recording. Check camera/mic permissions.',
      );
    } finally {
      setStarting(false);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || recorderRef.current.state !== 'recording') return;
    setStopping(true);
    try {
      recorderRef.current.stop();
      if (clipAudioElRef.current) {
        clipAudioElRef.current.pause();
      }
    } finally {
      setStopping(false);
    }
  };

  const reRecord = async () => {
    clearRecordedPreview();
    await startRecording();
  };

  const postToFeed = async () => {
    if (!recordedFile) {
      setError('Record your video first.');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await discoveryApi.createFeedPost(recordedFile, caption.trim() || undefined);
      router.push('/discover?tab=feed');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to post video.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Create feed video</h1>
          <p className="text-sm text-muted-foreground">
            Start recording and the Discover clip audio plays immediately so your
            video syncs to the beat.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/social/discover/list">Back to Discover list</Link>
        </Button>
      </div>

      {!canPostToFeed && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              You need Catalyst or admin access to post to the full feed.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedClip ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Source clip</p>
              <p className="font-medium text-foreground">
                {selectedClip.songTitle}
                {selectedClip.artistName ? ` - ${selectedClip.artistName}` : ''}
              </p>
            </div>
            <audio controls src={selectedClip.clipUrl} preload="metadata" className="w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="font-medium text-foreground">Choose a Discover clip</p>
              <p className="text-sm text-muted-foreground">
                Pick one of your liked clips to sync against while recording.
              </p>
            </div>
            {loadingLikedClips ? (
              <div className="flex justify-center py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : likedClips.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No liked Discover clips found yet.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/social/discover">Open Discover swipe</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {likedClips.map((clip) => (
                  <button
                    key={clip.songId}
                    type="button"
                    onClick={() =>
                      setSelectedClip({
                        clipUrl: clip.clipUrl,
                        songTitle: clip.title,
                        artistName: clip.artistDisplayName ?? clip.artistName,
                      })
                    }
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium text-foreground">{clip.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {clip.artistDisplayName ?? clip.artistName}
                      </p>
                    </div>
                    <span className="text-xs text-primary">Use clip</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative overflow-hidden rounded-xl border bg-black">
            <video
              ref={previewVideoRef}
              muted
              playsInline
              autoPlay
              className="h-[420px] w-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void startRecording()}
              disabled={starting || state === 'recording' || !canPostToFeed || !selectedClip?.clipUrl}
            >
              {starting ? 'Preparing...' : state === 'recording' ? 'Recording...' : 'Start recording with clip'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void stopRecording()}
              disabled={state !== 'recording' || stopping}
            >
              {stopping ? 'Stopping...' : 'Stop'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {recordedUrl && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="caption">Caption (optional)</Label>
              <Input
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
              />
            </div>
            <video
              src={recordedUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-lg border"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void reRecord()}
                disabled={posting || !canPostToFeed}
              >
                Re-record
              </Button>
              <Button onClick={() => void postToFeed()} disabled={posting || !canPostToFeed}>
                {posting ? 'Posting...' : 'Post to full feed'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
