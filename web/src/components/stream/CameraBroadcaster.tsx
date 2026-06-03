'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Loader2,
} from 'lucide-react';

type BroadcastState = 'idle' | 'requesting' | 'connecting' | 'live' | 'error';

type Props = {
  /** Cloudflare WebRTC/WHIP publish URL (ends in /webRTC/publish). */
  whipUrl: string;
  /**
   * Start broadcasting audio-only (camera off). The DJ can still turn the
   * camera on later. Recommended for audio-only DJ sets: no video is captured
   * or sent, which avoids paying to stream video.
   */
  startCameraOff?: boolean;
};

/**
 * In-app camera broadcaster. Captures the device camera + mic, shows a local
 * self-preview, and publishes to Cloudflare Stream via WHIP (WebRTC-HTTP
 * Ingestion Protocol). Works on desktop and mobile browsers over HTTPS.
 *
 * When the camera is toggled off, the video track is stopped and detached from
 * the WebRTC sender (replaceTrack(null)), so NO video bytes are sent upstream —
 * the session continues audio-only until the camera is turned back on. A video
 * transceiver is always created up front so toggling needs no renegotiation.
 */
export function CameraBroadcaster({ whipUrl, startCameraOff = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resourceUrlRef = useRef<string | null>(null);
  const facingRef = useRef<'user' | 'environment'>('user');
  // The single video sender; we swap its track in/out to toggle the camera
  // without renegotiating the WHIP session.
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const startCameraOffRef = useRef(startCameraOff);

  const [state, setState] = useState<BroadcastState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(!startCameraOff);
  const [camBusy, setCamBusy] = useState(false);
  // Mirror the self-preview for the front camera (natural "mirror" feel). The
  // outgoing WHIP stream is unaffected — viewers see the unmirrored video.
  const [facing, setFacing] = useState<'user' | 'environment'>('user');

  const teardown = useCallback(async () => {
    try {
      if (resourceUrlRef.current) {
        // Best-effort WHIP session delete so Cloudflare frees the connection.
        void fetch(resourceUrlRef.current, { method: 'DELETE' }).catch(
          () => undefined,
        );
        resourceUrlRef.current = null;
      }
      pcRef.current?.getSenders().forEach((s) => {
        try {
          s.track?.stop();
        } catch {
          /* noop */
        }
      });
      pcRef.current?.close();
      pcRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    } catch {
      /* noop */
    }
  }, []);

  const waitForIceGathering = useCallback((pc: RTCPeerConnection) => {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = setTimeout(() => resolve(), 2500);
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
    });
  }, []);

  const start = useCallback(async () => {
    if (!whipUrl) return;
    setError(null);
    setState('requesting');
    try {
      const wantCamera = !startCameraOffRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wantCamera ? { facingMode: facingRef.current } : false,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMicOn(stream.getAudioTracks().some((t) => t.enabled));
      const videoTrack = stream.getVideoTracks()[0] ?? null;
      setCamOn(!!videoTrack);

      setState('connecting');
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      });
      pcRef.current = pc;

      // Audio sender.
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) pc.addTrack(audioTrack, stream);

      // Always create exactly one video sender/m-line up front. When starting
      // audio-only, it carries no track (no video sent); toggling the camera
      // later just swaps a track into this same sender — no renegotiation.
      if (videoTrack) {
        videoSenderRef.current = pc.addTrack(videoTrack, stream);
      } else {
        const tx = pc.addTransceiver('video', { direction: 'sendonly' });
        videoSenderRef.current = tx.sender;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const res = await fetch(whipUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? offer.sdp ?? '',
      });
      if (!res.ok) {
        throw new Error(`Publish failed (${res.status})`);
      }
      const location = res.headers.get('Location');
      if (location) {
        try {
          resourceUrlRef.current = new URL(location, whipUrl).toString();
        } catch {
          resourceUrlRef.current = location;
        }
      }
      const answer = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      setState('live');
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Could not start camera broadcast';
      setError(
        msg.includes('Permission') || msg.includes('denied')
          ? 'Camera/microphone permission was denied. Allow access and try again.'
          : msg,
      );
      setState('error');
      await teardown();
    }
  }, [whipUrl, waitForIceGathering, teardown]);

  useEffect(() => {
    startCameraOffRef.current = startCameraOff;
  }, [startCameraOff]);

  useEffect(() => {
    void start();
    return () => {
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whipUrl]);

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  /**
   * Toggle the camera. Turning it OFF stops the camera hardware and detaches
   * the track from the sender so no video is transmitted (saves bandwidth/cost
   * and turns off the camera light). Turning it back ON re-acquires the camera
   * and swaps the track into the existing video sender.
   */
  const toggleCam = async () => {
    const sender = videoSenderRef.current;
    if (!sender || camBusy) return;
    setCamBusy(true);
    try {
      if (camOn) {
        try {
          await sender.replaceTrack(null);
        } catch {
          /* noop */
        }
        const old = streamRef.current?.getVideoTracks()[0];
        if (old) {
          streamRef.current?.removeTrack(old);
          old.stop();
        }
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current ?? null;
        }
        setCamOn(false);
      } else {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingRef.current },
          audio: false,
        });
        const newTrack = newStream.getVideoTracks()[0];
        await sender.replaceTrack(newTrack);
        streamRef.current?.addTrack(newTrack);
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play().catch(() => undefined);
        }
        setCamOn(true);
      }
    } catch {
      setError('Could not switch the camera. Check device permissions.');
    } finally {
      setCamBusy(false);
    }
  };

  const flipCamera = async () => {
    if (!camOn || camBusy) return;
    facingRef.current = facingRef.current === 'user' ? 'environment' : 'user';
    setFacing(facingRef.current);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = videoSenderRef.current;
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack);
      }
      // Swap the preview's video track, keep the existing audio track.
      const oldVideo = streamRef.current?.getVideoTracks()[0];
      if (oldVideo) {
        streamRef.current?.removeTrack(oldVideo);
        oldVideo.stop();
      }
      streamRef.current?.addTrack(newTrack);
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
    } catch {
      /* device may not have a second camera */
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Camera broadcast</p>
        {state === 'live' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            ON AIR
          </span>
        )}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover ${
            facing === 'user' ? '-scale-x-100' : ''
          }`}
        />
        {(state === 'requesting' || state === 'connecting') && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-sm text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            {state === 'requesting' ? 'Requesting camera…' : 'Connecting…'}
          </div>
        )}
        {!camOn && state === 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black text-center text-sm text-white/70">
            <VideoOff className="h-6 w-6" />
            <span>Camera off · audio only</span>
            <span className="text-xs text-white/40">No video is being sent</span>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void start()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {(state === 'live' || state === 'connecting') && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={micOn ? 'outline' : 'destructive'}
            size="sm"
            className="flex-1"
            onClick={toggleMic}
          >
            {micOn ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
            {micOn ? 'Mic on' : 'Mic off'}
          </Button>
          <Button
            type="button"
            variant={camOn ? 'outline' : 'destructive'}
            size="sm"
            className="flex-1"
            onClick={() => void toggleCam()}
            disabled={camBusy}
          >
            {camBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : camOn ? (
              <Video className="h-4 w-4" />
            ) : (
              <VideoOff className="h-4 w-4" />
            )}
            {camOn ? 'Camera on' : 'Camera off'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void flipCamera()}
            title="Switch camera"
            disabled={!camOn || camBusy}
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Broadcasting straight from this device&apos;s mic{camOn ? ' and camera' : ''}.
        Turning the camera off sends audio only (no video) to save bandwidth.
        Keep this panel open while you&apos;re live.
      </p>
    </div>
  );
}
