import Hls from 'hls.js';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { canPlayNativeHls } from '@/lib/browser-audio';

export type DjOverlayState = {
  active: boolean;
  /** Legacy HLS URL — Cloudflare never serves HLS for WHIP-ingested mics. */
  hlsUrl: string | null;
  /** WHEP (WebRTC) playback URL — the stream listeners actually play. */
  whepUrl: string | null;
  duckVolume: number;
};

export type DjBoothServerState = {
  transportPaused?: boolean;
  djOverlay?: DjOverlayState | null;
};

export type DjBoothEvent =
  | { type: 'transport_pause'; positionSeconds: number }
  | { type: 'transport_play'; positionSeconds: number }
  | {
      type: 'mic_on';
      duckVolume: number;
      hlsUrl: string | null;
      whepUrl?: string | null;
    }
  | { type: 'mic_off' }
  | { type: 'duck_volume'; duckVolume: number }
  | {
      type: 'soundboard_play';
      clipId: string;
      clipUrl: string;
      clipName: string;
      durationSeconds: number;
    }
  | { type: 'queue_updated' };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let sharedSupabase: SupabaseClient | null = null;

function getSharedSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!sharedSupabase) {
    sharedSupabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return sharedSupabase;
}

type BoothChannelEntry = {
  channel: RealtimeChannel;
  listeners: Set<(event: DjBoothEvent) => void>;
};

const boothChannelsByStation = new Map<string, BoothChannelEntry>();

export function parseDjOverlay(raw: unknown): DjOverlayState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const hls = (o.hls_url ?? o.hlsUrl) as string | null | undefined;
  const whep = (o.whep_url ?? o.whepUrl) as string | null | undefined;
  return {
    active: !!o.active,
    hlsUrl: typeof hls === 'string' ? hls : null,
    whepUrl: typeof whep === 'string' ? whep : null,
    duckVolume: typeof o.duck_volume === 'number' ? o.duck_volume : typeof o.duckVolume === 'number' ? o.duckVolume : 0.25,
  };
}

export function subscribeDjBoothEvents(
  stationId: string,
  onEvent: (event: DjBoothEvent) => void,
): () => void {
  const supabase = getSharedSupabase();
  if (!supabase || !stationId) return () => undefined;

  let entry = boothChannelsByStation.get(stationId);
  if (!entry) {
    const listeners = new Set<(event: DjBoothEvent) => void>();
    const channel = supabase
      .channel(`dj-booth:${stationId}`)
      .on('broadcast', { event: 'dj_booth_event' }, (payload) => {
        const event = payload.payload as DjBoothEvent;
        if (!event?.type) return;
        for (const listener of listeners) {
          listener(event);
        }
      })
      .subscribe();
    entry = { channel, listeners };
    boothChannelsByStation.set(stationId, entry);
  }

  entry.listeners.add(onEvent);
  return () => {
    entry!.listeners.delete(onEvent);
    if (entry!.listeners.size === 0) {
      void supabase.removeChannel(entry!.channel);
      boothChannelsByStation.delete(stationId);
    }
  };
}

export type OverlayController = {
  overlayAudio: HTMLAudioElement;
  hlsRef: { current: Hls | null };
  userVolume: number;
  duckVolume: number;
  micActive: boolean;
};

const overlayAttachState = new WeakMap<
  HTMLAudioElement,
  { url: string | null; active: boolean }
>();

/** Live WHEP peer connection per overlay element. */
type WhepSession = {
  pc: RTCPeerConnection;
  url: string;
  resourceUrl: string | null;
  disposed: boolean;
};

const whepSessions = new WeakMap<HTMLAudioElement, WhepSession>();

/**
 * Overlays whose play() was blocked by the browser autoplay policy: they run
 * muted (always allowed) so decoding starts, and unmute on the next gesture.
 */
const pendingGestureUnmute = new WeakSet<HTMLAudioElement>();

export function applyOverlayVolume(
  controller: OverlayController,
  micActive: boolean,
) {
  const v = micActive ? Math.max(0, Math.min(1, controller.userVolume)) : 0;
  controller.overlayAudio.volume = v;
  const wantMuted = v <= 0.001;
  // Never unmute an autoplay-blocked overlay from a poll — only the gesture
  // handler may do that, otherwise Chrome pauses the element again.
  if (!wantMuted && pendingGestureUnmute.has(controller.overlayAudio)) return;
  controller.overlayAudio.muted = wantMuted;
}

/**
 * Start overlay playback, surviving the browser autoplay policy. When play()
 * is blocked (listener never interacted with the page — e.g. the radio
 * auto-resumed on load), fall back to muted playback so the WHEP audio starts
 * decoding, and unmute + replay on the listener's first gesture. Without this
 * the DJ talk-over stays silent forever while the music sits ducked.
 */
function playOverlayWithAutoplayFallback(controller: OverlayController) {
  const overlay = controller.overlayAudio;
  overlay.play().then(
    () => undefined,
    (err: unknown) => {
      const name = (err as Error | undefined)?.name;
      if (name !== 'NotAllowedError') return;
      console.warn('[dj-overlay] play() blocked by autoplay policy; starting muted until next gesture');
      overlay.muted = true;
      overlay.play().catch(() => undefined);
      armGestureUnmute(controller);
    },
  );
}

function armGestureUnmute(controller: OverlayController) {
  const overlay = controller.overlayAudio;
  if (pendingGestureUnmute.has(overlay)) return;
  pendingGestureUnmute.add(overlay);
  const onGesture = () => {
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    document.removeEventListener('touchstart', onGesture, true);
    pendingGestureUnmute.delete(overlay);
    const attach = overlayAttachState.get(overlay);
    const micActive = !!attach?.active;
    applyOverlayVolume(controller, micActive);
    if (micActive) overlay.play().catch(() => undefined);
  };
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);
  document.addEventListener('touchstart', onGesture, true);
}

/** Close any live WHEP connection attached to an overlay element. */
export function teardownOverlayWhep(overlayAudio: HTMLAudioElement) {
  teardownWhep(overlayAudio);
}

function teardownWhep(overlayAudio: HTMLAudioElement) {
  pendingGestureUnmute.delete(overlayAudio);
  const session = whepSessions.get(overlayAudio);
  if (!session) return;
  session.disposed = true;
  if (session.resourceUrl) {
    void fetch(session.resourceUrl, { method: 'DELETE' }).catch(() => undefined);
  }
  try {
    session.pc.close();
  } catch {
    /* noop */
  }
  whepSessions.delete(overlayAudio);
  if (overlayAudio.srcObject) {
    overlayAudio.srcObject = null;
  }
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
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
}

/**
 * Play the DJ mic via WHEP (WebRTC-HTTP Egress). This is the only playback
 * path Cloudflare supports for WHIP-published streams — HLS manifests return
 * 204 for WebRTC-ingested live inputs.
 */
async function startWhep(
  controller: OverlayController,
  whepUrl: string,
  autoPlay: boolean,
): Promise<void> {
  const { overlayAudio } = controller;
  teardownWhep(overlayAudio);

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
  });
  const session: WhepSession = {
    pc,
    url: whepUrl,
    resourceUrl: null,
    disposed: false,
  };
  whepSessions.set(overlayAudio, session);

  // Audio ONLY. The booth mic input also negotiates a video m-line that never
  // carries frames (trackless sender on the publisher); if that dead video
  // track ends up in the element's MediaStream, Chrome waits forever for the
  // first video frame and never starts AUDIO either (readyState stays 0,
  // zero samples decoded) — listeners get ducked music and eternal silence.
  pc.addTransceiver('audio', { direction: 'recvonly' });

  pc.ontrack = (event) => {
    if (session.disposed) return;
    if (event.track.kind !== 'audio') return;
    const stream = new MediaStream([event.track]);
    if (overlayAudio.srcObject !== stream) {
      overlayAudio.srcObject = stream;
    }
    applyOverlayVolume(controller, controller.micActive);
    if (autoPlay) playOverlayWithAutoplayFallback(controller);
  };

  const scheduleRetry = () => {
    if (session.disposed) return;
    teardownWhep(overlayAudio);
    window.setTimeout(() => {
      const attach = overlayAttachState.get(overlayAudio);
      if (attach?.url === whepUrl && attach.active) {
        void startWhep(controller, whepUrl, autoPlay);
      }
    }, 2000);
  };

  pc.onconnectionstatechange = () => {
    if (
      pc.connectionState === 'failed' ||
      pc.connectionState === 'disconnected'
    ) {
      scheduleRetry();
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const res = await fetch(whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription?.sdp ?? offer.sdp ?? '',
    });
    if (!res.ok) {
      throw new Error(`WHEP negotiation failed (${res.status})`);
    }
    const location = res.headers.get('Location');
    if (location) {
      try {
        session.resourceUrl = new URL(location, whepUrl).toString();
      } catch {
        session.resourceUrl = location;
      }
    }
    const answer = await res.text();
    if (session.disposed) return;
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
  } catch {
    scheduleRetry();
  }
}

function attachOverlayLegacyHls(
  controller: OverlayController,
  hlsUrl: string,
  autoPlay: boolean,
) {
  const { overlayAudio, hlsRef } = controller;
  const startPlayback = () => {
    applyOverlayVolume(controller, controller.micActive);
    if (autoPlay) playOverlayWithAutoplayFallback(controller);
  };

  if (canPlayNativeHls(overlayAudio)) {
    overlayAudio.src = hlsUrl;
    overlayAudio.addEventListener('canplay', startPlayback, { once: true });
    if (autoPlay) playOverlayWithAutoplayFallback(controller);
  } else if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      liveSyncDurationCount: 3,
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(overlayAudio);
    hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      hls.destroy();
      hlsRef.current = null;
      window.setTimeout(() => {
        if (overlayAttachState.get(overlayAudio)?.url === hlsUrl) {
          attachOverlayStream(controller, hlsUrl, autoPlay);
        }
      }, 2000);
    });
    hlsRef.current = hls;
  } else {
    overlayAudio.src = hlsUrl;
    overlayAudio.addEventListener('canplay', startPlayback, { once: true });
    if (autoPlay) overlayAudio.play().catch(() => undefined);
  }
}

/**
 * Attach the DJ mic stream to the overlay element. WHEP URLs
 * (`…/webRTC/play`) use a WebRTC connection; `.m3u8` URLs use the legacy HLS
 * path (only valid for RTMP-ingested inputs).
 */
export function attachOverlayStream(
  controller: OverlayController,
  streamUrl: string | null,
  autoPlay: boolean,
) {
  const { overlayAudio, hlsRef } = controller;
  if (hlsRef.current) {
    hlsRef.current.destroy();
    hlsRef.current = null;
  }
  teardownWhep(overlayAudio);
  overlayAudio.pause();
  overlayAudio.removeAttribute('src');
  overlayAudio.load();
  if (!streamUrl) {
    overlayAttachState.set(overlayAudio, { url: null, active: false });
    return;
  }

  overlayAttachState.set(overlayAudio, { url: streamUrl, active: true });

  if (streamUrl.includes('/webRTC/play')) {
    void startWhep(controller, streamUrl, autoPlay);
  } else if (streamUrl.includes('.m3u8')) {
    attachOverlayLegacyHls(controller, streamUrl, autoPlay);
  } else {
    overlayAudio.src = streamUrl;
    const startPlayback = () => {
      applyOverlayVolume(controller, controller.micActive);
      if (autoPlay) playOverlayWithAutoplayFallback(controller);
    };
    overlayAudio.addEventListener('canplay', startPlayback, { once: true });
    if (autoPlay) playOverlayWithAutoplayFallback(controller);
  }
}

/** Attach or refresh the mic overlay only when URL/active state actually changes. */
export function syncOverlayStream(
  controller: OverlayController,
  overlay: {
    active: boolean;
    hlsUrl: string | null;
    whepUrl?: string | null;
  } | null,
  autoPlay: boolean,
) {
  const { overlayAudio } = controller;
  const prev = overlayAttachState.get(overlayAudio) ?? { url: null, active: false };
  const streamUrl = overlay?.whepUrl || overlay?.hlsUrl || null;
  const nextActive = !!overlay?.active && !!streamUrl;
  const nextUrl = nextActive ? streamUrl : null;

  if (!nextActive) {
    if (prev.active || prev.url) {
      attachOverlayStream(controller, null, false);
    }
    applyOverlayVolume(controller, false);
    return;
  }

  if (prev.url === nextUrl && prev.active) {
    applyOverlayVolume(controller, true);
    if (autoPlay && overlayAudio.paused) {
      playOverlayWithAutoplayFallback(controller);
    }
    return;
  }

  attachOverlayStream(controller, nextUrl, autoPlay);
}

export function applyDuckToMain(
  mainAudio: HTMLAudioElement,
  userVolume: number,
  overlay: OverlayController,
) {
  const duck = overlay.micActive ? overlay.duckVolume : 1;
  const v = Math.max(0, Math.min(1, userVolume * duck));
  mainAudio.volume = v;
  mainAudio.muted = v <= 0.001;
}

export async function playSoundboardClipOnOverlay(
  controller: OverlayController,
  clipUrl: string,
  durationSeconds: number,
  mainAudio: HTMLAudioElement | null,
  userVolume: number,
) {
  const prevMic = controller.micActive;
  controller.micActive = true;
  controller.duckVolume = 0.2;
  if (mainAudio) applyDuckToMain(mainAudio, userVolume, controller);
  applyOverlayVolume(controller, true);

  // srcObject (a live WHEP mic stream) takes precedence over src, so detach
  // it while the clip plays and restore it afterwards.
  const overlay = controller.overlayAudio;
  const liveStream = overlay.srcObject;
  if (liveStream) overlay.srcObject = null;

  overlay.src = clipUrl;
  await overlay.play().catch(() => undefined);

  await new Promise((r) => setTimeout(r, Math.min(30000, durationSeconds * 1000)));

  overlay.pause();
  overlay.removeAttribute('src');
  if (liveStream) {
    overlay.srcObject = liveStream;
    applyOverlayVolume(controller, prevMic);
    if (prevMic) overlay.play().catch(() => undefined);
  }
  controller.micActive = prevMic;
  if (mainAudio) applyDuckToMain(mainAudio, userVolume, controller);
}
