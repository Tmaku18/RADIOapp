'use client';

import { useEffect, useRef, useState } from 'react';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import type { PlaybackTrack } from '@/components/playback';
import { discoveryApi, songStoriesApi, type StoryVisibility } from '@/lib/api';
import { artistShareText, stationShareText } from '@/lib/radio-share';
import { startLiveSongRecording, startMirrorLoop } from '@/lib/social-share';
import { ArtistCreditOverlay, ArtistCreditTray } from '@/components/radio/ArtistCreditOverlay';
import { CaptureShutter } from '@/components/radio/CaptureShutter';
import { SocialShareButtons } from '@/components/radio/SocialShareButtons';
import { burnArtistCredit, type ArtistCreditStyle } from '@/lib/artist-credit';

const CLIP_SECONDS = 15;

function captionFor(track: PlaybackTrack): string {
  const artist = track.artistId?.trim();
  if (artist) {
    return artistShareText({
      artistId: artist,
      artistName: track.artistName,
      songId: track.id,
      songTitle: track.title,
    });
  }
  const station = track.radioId?.trim();
  if (station) return stationShareText(station);
  const name = track.artistName.trim();
  return name ? `${track.title} — ${name}` : track.title;
}

export function RadioCaptureDialog({
  track,
  stream,
  onClose,
  offsetSeconds,
  durationSeconds,
}: {
  track: PlaybackTrack;
  stream: MediaStream;
  onClose: () => void;
  /** Start point in the full song. Omit to use whatever the player is on. */
  offsetSeconds?: number;
  durationSeconds?: number;
}) {
  const playbackRef = useRef(usePlaybackOptional());
  const live = usePlaybackOptional();
  playbackRef.current = live;

  const videoRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawStop = useRef<(() => void) | null>(null);
  const recorder = useRef<{ stop: () => Promise<File>; cancel: () => void } | null>(null);
  const stopTimer = useRef<number | null>(null);
  const held = useRef(false);
  const finishing = useRef(false);
  const tick = useRef<number | null>(null);
  const clipUrl = useRef<string | null>(null);

  const [phase, setPhase] = useState<'ready' | 'recording' | 'saving' | 'review'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ file: File; url: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [postingStory, setPostingStory] = useState(false);
  const [storyVisibility, setStoryVisibility] = useState<StoryVisibility>('public');
  const [preparing, setPreparing] = useState(false);
  const [creditStyle, setCreditStyle] = useState<ArtistCreditStyle | null>('words');
  const [creditX, setCreditX] = useState(0.5);
  const [creditY, setCreditY] = useState(0.58);
  const [creditScale, setCreditScale] = useState(1);
  const [reviewPlaying, setReviewPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const pressGen = useRef(0);
  const recordingFlag = useRef(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const burned = useRef<{ key: string; file: File } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    video.srcObject = stream;
    video.muted = true;
    void video.play().catch(() => undefined);
    drawStop.current = startMirrorLoop(video, canvas);
    return () => {
      drawStop.current?.();
      if (stopTimer.current != null) window.clearTimeout(stopTimer.current);
      recorder.current?.cancel();
      stream.getTracks().forEach((item) => item.stop());
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
      if (held.current) {
        held.current = false;
        playbackRef.current?.actions.releaseExternalMedia();
      }
    };
  }, [stream]);

  const restartPreview = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    drawStop.current?.();
    drawStop.current = startMirrorLoop(video, canvas);
  };

  const finish = async (handle: { stop: () => Promise<File> }) => {
    if (finishing.current) return;
    finishing.current = true;
    if (stopTimer.current != null) {
      window.clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
    if (tick.current != null) {
      window.clearInterval(tick.current);
      tick.current = null;
    }
    drawStop.current?.();
    recordingFlag.current = false;
    setProgress(0);
    setPhase('saving');
    try {
      const file = await handle.stop();
      if (file.size < 1000) {
        setPhase('ready');
        restartPreview();
        return;
      }
      const url = URL.createObjectURL(file);
      clipUrl.current = url;
      setClip({ file, url });
      setPhase('review');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish that clip.');
      setPhase('ready');
      restartPreview();
    } finally {
      finishing.current = false;
    }
  };

  const begin = async (kind: 'photo' | 'video', gen?: number) => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'ready') return;
    if (typeof canvas.captureStream !== 'function') {
      setError('This browser cannot save the song into a clip. Use the phone app.');
      return;
    }
    const pb = playbackRef.current;
    const offset = offsetSeconds ?? pb?.state.currentTime ?? 0;
    const liveDuration = pb?.state.duration || track.durationSeconds || CLIP_SECONDS;
    const total =
      durationSeconds != null && durationSeconds > 0 ? durationSeconds : liveDuration;
    const length = Math.min(CLIP_SECONDS, Math.max(1, total - offset));
    if (pb && !held.current) {
      held.current = true;
      pb.actions.holdForExternalMedia();
    }
    if (kind === 'photo') drawStop.current?.();
    const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
    if (!videoTrack) {
      setError('Could not open the camera.');
      if (kind === 'photo') restartPreview();
      return;
    }
    setError(null);
    setProgress(0);
    let handle: { stop: () => Promise<File>; cancel: () => void };
    try {
      handle = await startLiveSongRecording({
        videoTrack,
        audioUrl: track.audioUrl,
        offsetSeconds: offset,
        micStream: stream,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the recording.');
      if (kind === 'photo') restartPreview();
      return;
    }
    if (kind === 'video' && gen != null && gen !== pressGen.current) {
      handle.cancel();
      return;
    }
    recorder.current = handle;
    recordingFlag.current = kind === 'video';
    setPhase(kind === 'photo' ? 'saving' : 'recording');
    const started = Date.now();
    tick.current = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      setProgress(Math.min(1, elapsed / length));
    }, 50);
    stopTimer.current = window.setTimeout(() => {
      void finish(handle);
    }, length * 1000);
  };

  const retake = () => {
    reviewRef.current?.pause();
    if (held.current) {
      held.current = false;
      playbackRef.current?.actions.releaseExternalMedia();
    }
    if (clip) {
      URL.revokeObjectURL(clip.url);
      clipUrl.current = null;
    }
    setClip(null);
    burned.current = null;
    setAspect(null);
    setPhase('ready');
    setProgress(0);
    restartPreview();
  };

  const creditKey = `${creditStyle}|${creditX.toFixed(3)}|${creditY.toFixed(3)}|${creditScale}`;

  const clipWithCredit = async () => {
    if (!clip) throw new Error('Record a clip first.');
    if (!creditStyle) return clip.file;
    if (burned.current?.key === creditKey) return burned.current.file;
    const file = await burnArtistCredit(clip.file, {
      style: creditStyle,
      x: creditX,
      y: creditY,
      scale: creditScale,
      title: track.title,
      artist: track.artistName,
    });
    burned.current = { key: creditKey, file };
    return file;
  };

  const postStory = async () => {
    if (!clip || postingStory || !/^[0-9a-f-]{36}$/i.test(track.id)) return;
    setPostingStory(true);
    setPreparing(creditStyle != null);
    setError(null);
    try {
      const file = await clipWithCredit();
      const artist = track.artistName.trim();
      await songStoriesApi.upload(file, {
        songId: track.id,
        visibility: storyVisibility,
        caption: artist ? `${track.title} — ${artist}` : track.title,
      });
      toast.success(
        storyVisibility === 'hidden'
          ? 'Hidden story posted. Only you can see it, for 24 hours.'
          : storyVisibility === 'private'
            ? 'Private story posted. Friends can see it, for 24 hours.'
            : 'Story posted. It shows on the radio while this song plays, for 24 hours.',
      );
    } catch {
      setError('Could not post that story. Sign in if you have not, then try again.');
    } finally {
      setPostingStory(false);
      setPreparing(false);
    }
  };

  const post = async () => {
    if (!clip || posting) return;
    setPosting(true);
    setPreparing(creditStyle != null);
    setError(null);
    try {
      const file = await clipWithCredit();
      await discoveryApi.createFeedPost(file, captionFor(track));
      toast.success('Posted to your feed with this song.');
    } catch {
      setError('Could not post that clip. Sign in if you have not, then try again.');
    } finally {
      setPosting(false);
      setPreparing(false);
    }
  };

  const capturing = phase === 'ready' || phase === 'recording';

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      <div className="relative h-full w-full">
        <video ref={videoRef} autoPlay muted playsInline className="hidden" />
        {phase === 'review' && clip ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="relative h-full max-w-full"
              style={{ aspectRatio: aspect && aspect > 0 ? String(aspect) : '9 / 16' }}
              onPointerDown={(event) => {
                const video = event.currentTarget.querySelector('video');
                if (video?.paused) void video.play();
              }}
            >
              <video
                ref={reviewRef}
                src={clip.url}
                autoPlay
                loop
                playsInline
                className="h-full w-full bg-black object-contain"
                onLoadedMetadata={(event) => {
                  const item = event.currentTarget;
                  item.muted = false;
                  item.volume = 1;
                  if (item.videoWidth > 0 && item.videoHeight > 0) {
                    setAspect(item.videoWidth / item.videoHeight);
                  }
                }}
                onPlay={() => setReviewPlaying(true)}
                onPause={() => setReviewPlaying(false)}
              />
              {creditStyle ? (
                <ArtistCreditOverlay
                  title={track.title}
                  artist={track.artistName}
                  style={creditStyle}
                  x={creditX}
                  y={creditY}
                  scale={creditScale}
                  onMove={(nextX, nextY) => {
                    setCreditX(nextX);
                    setCreditY(nextY);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl text-white"
        >
          ×
        </button>
        {error && phase !== 'review' ? (
          <p className="absolute inset-x-6 bottom-32 z-20 text-center text-sm text-red-300">{error}</p>
        ) : null}
        {phase === 'saving' ? (
          <p className="absolute inset-x-0 top-1/2 z-20 text-center text-sm">Adding the song…</p>
        ) : null}
        {capturing ? (
          <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center">
            <CaptureShutter
              progress={progress}
              recording={phase === 'recording'}
              disabled={phase !== 'ready' && phase !== 'recording'}
              onHoldStart={() => {
                const gen = ++pressGen.current;
                void begin('video', gen);
              }}
              onHoldEnd={() => {
                pressGen.current += 1;
                if (recordingFlag.current && recorder.current) void finish(recorder.current);
              }}
              onTap={() => void begin('photo')}
            />
          </div>
        ) : null}
        {phase === 'review' && clip ? (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[42%] overflow-y-auto bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-8">
            {error ? <p className="mb-2 text-xs text-red-300">{error}</p> : null}
            <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const video = reviewRef.current;
                if (!video) return;
                video.muted = false;
                video.volume = 1;
                if (video.paused) void video.play();
                else video.pause();
              }}
              className="rounded-full border border-white/20 px-4 py-2 text-sm"
            >
              {reviewPlaying ? 'Pause' : 'Play clip'}
            </button>
            <ArtistCreditTray
              style={creditStyle}
              scale={creditScale}
              disabled={posting || postingStory || preparing}
              onStyle={setCreditStyle}
              onScale={setCreditScale}
            />
            {preparing ? <p className="text-xs text-white/70">Adding the artist credit…</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void post()}
                disabled={posting || postingStory}
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                {posting ? 'Posting…' : 'Post to feed'}
              </button>
              {/^[0-9a-f-]{36}$/i.test(track.id) ? (
                <button
                  type="button"
                  onClick={() => void postStory()}
                  disabled={posting || postingStory}
                  className="rounded-full border border-cyan-300 px-4 py-2 text-sm disabled:opacity-40"
                >
                  {postingStory ? 'Posting story…' : 'Post as story'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={retake}
                disabled={posting || postingStory}
                className="rounded-full border border-white/20 px-4 py-2 text-sm"
              >
                Retake
              </button>
            </div>
            {/^[0-9a-f-]{36}$/i.test(track.id) ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold">Who can see this story</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['public', 'Public'],
                      ['private', 'Private'],
                      ['hidden', 'Hidden'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={postingStory}
                      onClick={() => setStoryVisibility(value)}
                      className={
                        storyVisibility === value
                          ? 'rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-black'
                          : 'rounded-full border border-white/20 px-3 py-1 text-xs'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/60">
                  {storyVisibility === 'hidden'
                    ? 'Hidden. Only you can see it. Lasts 24 hours.'
                    : storyVisibility === 'private'
                      ? 'Private. Friends can see it. Lasts 24 hours.'
                      : 'Public. Shows on the radio while this song plays. Lasts 24 hours.'}
                </p>
              </div>
            ) : null}
            <SocialShareButtons
              caption={captionFor(track)}
              getFile={async () => {
                setPreparing(creditStyle != null);
                try {
                  return await clipWithCredit();
                } finally {
                  setPreparing(false);
                }
              }}
            />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RadioCaptureButton({ compact = false }: { compact?: boolean }) {
  const playback = usePlaybackOptional();
  const [opening, setOpening] = useState(false);
  const [session, setSession] = useState<{
    track: PlaybackTrack;
    stream: MediaStream;
  } | null>(null);

  const track = playback?.state.track;
  if (!track?.audioUrl && !session) return null;

  const open = async () => {
    const current = playback?.state.track;
    if (!current?.audioUrl || opening) return;
    if (current.audioUrl.toLowerCase().includes('.m3u8')) {
      toast.error('This live stream cannot be saved into a clip.');
      return;
    }
    setOpening(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setSession({ track: current, stream });
    } catch (error) {
      stream?.getTracks().forEach((item) => item.stop());
      toast.error(
        error instanceof Error
          ? error.message
          : 'Allow the camera and microphone to record.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      {track?.audioUrl ? (
        <button
          type="button"
          onClick={() => void open()}
          disabled={opening}
          data-testid="radio-capture"
          title="Record with this song"
          className={
            compact
              ? 'w-8 h-8 rounded-full bg-white/5 dim-text flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-40'
              : 'h-10 px-4 rounded-full border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 text-xs font-dim-mono tracking-[0.18em] uppercase transition inline-flex items-center gap-2 disabled:opacity-40'
          }
        >
          <Video className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          {compact ? <span className="sr-only">Record</span> : opening ? 'Opening…' : 'Record'}
        </button>
      ) : null}
      {session ? (
        <RadioCaptureDialog
          track={session.track}
          stream={session.stream}
          onClose={() => setSession(null)}
        />
      ) : null}
    </>
  );
}
