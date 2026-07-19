import Hls from 'hls.js';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { canPlayNativeHls } from '@/lib/browser-audio';

export type DjOverlayState = {
  active: boolean;
  hlsUrl: string | null;
  duckVolume: number;
};

export type DjBoothServerState = {
  transportPaused?: boolean;
  djOverlay?: DjOverlayState | null;
};

export type DjBoothEvent =
  | { type: 'transport_pause'; positionSeconds: number }
  | { type: 'transport_play'; positionSeconds: number }
  | { type: 'mic_on'; duckVolume: number; hlsUrl: string | null }
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
  return {
    active: !!o.active,
    hlsUrl: typeof hls === 'string' ? hls : null,
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

export function applyOverlayVolume(
  controller: OverlayController,
  micActive: boolean,
) {
  const v = micActive ? Math.max(0, Math.min(1, controller.userVolume)) : 0;
  controller.overlayAudio.volume = v;
  controller.overlayAudio.muted = v <= 0.001;
}

export function attachOverlayHls(
  controller: OverlayController,
  hlsUrl: string | null,
  autoPlay: boolean,
) {
  const { overlayAudio, hlsRef } = controller;
  if (hlsRef.current) {
    hlsRef.current.destroy();
    hlsRef.current = null;
  }
  overlayAudio.pause();
  overlayAudio.removeAttribute('src');
  overlayAudio.load();
  if (!hlsUrl) {
    overlayAttachState.set(overlayAudio, { url: null, active: false });
    return;
  }

  const startPlayback = () => {
    applyOverlayVolume(controller, controller.micActive);
    if (autoPlay) overlayAudio.play().catch(() => undefined);
  };

  if (hlsUrl.includes('.m3u8') && canPlayNativeHls(overlayAudio)) {
    overlayAudio.src = hlsUrl;
    overlayAudio.addEventListener('canplay', startPlayback, { once: true });
    if (autoPlay) overlayAudio.play().catch(() => undefined);
  } else if (hlsUrl.includes('.m3u8') && Hls.isSupported()) {
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
          attachOverlayHls(controller, hlsUrl, autoPlay);
        }
      }, 2000);
    });
    hlsRef.current = hls;
  } else {
    overlayAudio.src = hlsUrl;
    overlayAudio.addEventListener('canplay', startPlayback, { once: true });
    if (autoPlay) overlayAudio.play().catch(() => undefined);
  }

  overlayAttachState.set(overlayAudio, { url: hlsUrl, active: true });
}

/** Attach or refresh the mic overlay only when URL/active state actually changes. */
export function syncOverlayHls(
  controller: OverlayController,
  overlay: { active: boolean; hlsUrl: string | null } | null,
  autoPlay: boolean,
) {
  const { overlayAudio } = controller;
  const prev = overlayAttachState.get(overlayAudio) ?? { url: null, active: false };
  const nextActive = !!overlay?.active && !!overlay?.hlsUrl;
  const nextUrl = nextActive ? overlay!.hlsUrl! : null;

  if (!nextActive) {
    if (prev.active || prev.url) {
      attachOverlayHls(controller, null, false);
    }
    applyOverlayVolume(controller, false);
    return;
  }

  if (prev.url === nextUrl && prev.active) {
    applyOverlayVolume(controller, true);
    if (autoPlay && overlayAudio.paused) {
      overlayAudio.play().catch(() => undefined);
    }
    return;
  }

  attachOverlayHls(controller, nextUrl, autoPlay);
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

  controller.overlayAudio.src = clipUrl;
  await controller.overlayAudio.play().catch(() => undefined);

  await new Promise((r) => setTimeout(r, Math.min(30000, durationSeconds * 1000)));

  controller.overlayAudio.pause();
  controller.overlayAudio.removeAttribute('src');
  controller.micActive = prevMic;
  if (mainAudio) applyDuckToMain(mainAudio, userVolume, controller);
}
