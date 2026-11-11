'use client';

import { useEffect, useRef, useState } from 'react';
import { Video } from 'lucide-react';
import { toast } from 'sonner';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import type { PlaybackTrack } from '@/components/playback';
import { discoveryApi, songStoriesApi, type StoryVisibility } from '@/lib/api';
import { artistShareText, stationShareText } from '@/lib/radio-share';
import {
  loadAudioBuffer,
  startMirrorLoop,
  startMixedRecording,
} from '@/lib/social-share';
import { ArtistCreditOverlay, ArtistCreditTray } from '@/components/radio/ArtistCreditOverlay';
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
  buffer,
  onClose,
  offsetSeconds,
  durationSeconds,
}: {
  track: PlaybackTrack;
  stream: MediaStream;
  buffer: AudioBuffer;
  onClose: () => void;
  /** Start point in the full song. Omit to use whatever the player is on. */
  offsetSeconds?: number;
  durationSeconds?: number;
}) {
  const playbackRef = useRef(usePlaybackOptional());
  const live = usePlaybackOptional();
  playbackRef.current = live;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawStop = useRef<(() => void) | null>(null);
  const recorder = useRef<{ stop: () => Promise<File>; cancel: () => void } | null>(null);
  const stopTimer = useRef<number | null>(null);
  const held = useRef(false);
  const wasMuted = useRef(true);
  const finishing = useRef(false);
  const tick = useRef<number | null>(null);
  const clipUrl = useRef<string | null>(null);

  const [phase, setPhase] = useState<'ready' | 'recording' | 'saving' | 'review'>('ready');
  const [seconds, setSeconds] = useState(0);
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
      if (held.current && !wasMuted.current) {
        void playbackRef.current?.actions.softResume();
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
    setPhase('saving');
    try {
      const file = await handle.stop();
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

  const begin = async (kind: 'photo' | 'video') => {
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
    if (pb && !pb.state.isMuted && !held.current) {
      wasMuted.current = false;
      held.current = true;
      pb.actions.softPause();
    }
    if (kind === 'photo') drawStop.current?.();
    const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
    if (!videoTrack) {
      setError('Could not open the camera.');
      if (kind === 'photo') restartPreview();
      return;
    }
    setError(null);
    setSeconds(0);
    let handle: { stop: () => Promise<File>; cancel: () => void };
    try {
      handle = await startMixedRecording({
        videoTrack,
        audioBuffer: buffer,
        offsetSeconds: offset,
        durationSeconds: length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the recording.');
      restartPreview();
      return;
    }
    recorder.current = handle;
    setPhase(kind === 'photo' ? 'saving' : 'recording');
    const started = Date.now();
    tick.current = window.setInterval(() => {
      setSeconds(Math.min(CLIP_SECONDS, Math.round((Date.now() - started) / 1000)));
    }, 250);
    stopTimer.current = window.setTimeout(() => {
      void finish(handle);
    }, length * 1000);
  };

  const retake = () => {
    if (clip) {
      URL.revokeObjectURL(clip.url);
      clipUrl.current = null;
    }
    setClip(null);
    burned.current = null;
    setAspect(null);
    setPhase('ready');
    setSeconds(0);
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

  const label = track.artistName.trim()
    ? `${track.title} — ${track.artistName}`
    : track.title;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold">Record with this song</p>
        <button type="button" onClick={onClose} className="text-sm text-white/80">
          Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
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
                src={clip.url}
                autoPlay
                loop
                playsInline
                className="h-full w-full bg-black object-contain"
                onLoadedMetadata={(event) => {
                  const item = event.currentTarget;
                  if (item.videoWidth > 0 && item.videoHeight > 0) {
                    setAspect(item.videoWidth / item.videoHeight);
                  }
                }}
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
      </div>
      <div className="space-y-3 bg-zinc-950 px-4 py-4">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="text-xs text-white/60">
          {phase === 'recording'
            ? `Recording ${seconds}s / ${CLIP_SECONDS}s`
            : 'Mic stays off. The song that is playing is saved into the clip.'}
        </p>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        {phase === 'saving' ? (
          <p className="text-sm">Adding the song…</p>
        ) : phase === 'review' && clip ? (
          <div className="space-y-3">
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
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={phase !== 'ready'}
              onClick={() => void begin('photo')}
              className="flex-1 rounded-full border border-white/20 py-2 text-sm disabled:opacity-40"
            >
              Photo
            </button>
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={() => {
                if (phase === 'recording' && recorder.current) {
                  void finish(recorder.current);
                  return;
                }
                void begin('video');
              }}
              className="flex-1 rounded-full bg-cyan-400 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {phase === 'recording' ? 'Stop' : 'Video'}
            </button>
          </div>
        )}
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
    buffer: AudioBuffer;
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
        audio: false,
      });
      const buffer = await loadAudioBuffer(current.audioUrl);
      setSession({ track: current, stream, buffer });
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
          buffer={session.buffer}
          onClose={() => setSession(null)}
        />
      ) : null}
    </>
  );
}
