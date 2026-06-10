import Hls from 'hls.js';
import { createClient } from '@supabase/supabase-js';

export type DjOverlayState = {
  active: boolean;
  hlsUrl: string | null;
  duckVolume: number;
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

export function parseDjOverlay(raw: unknown): DjOverlayState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const hls = (o.hls_url ?? o.hlsUrl) as string | null | undefined;
  return {
    active: !!o.active,
    hlsUrl: typeof hls === 'string' ? hls : null,
    duckVolume:
      typeof o.duck_volume === 'number'
        ? o.duck_volume
        : typeof o.duckVolume === 'number'
          ? o.duckVolume
          : 0.25,
  };
}

export function subscribeDjBoothEvents(
  stationId: string,
  onEvent: (event: DjBoothEvent) => void,
): () => void {
  if (!supabaseUrl || !supabaseAnonKey || !stationId) return () => undefined;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const channel = supabase
    .channel(`dj-booth:${stationId}`)
    .on('broadcast', { event: 'dj_booth_event' }, (payload) => {
      const event = payload.payload as DjBoothEvent;
      if (event?.type) onEvent(event);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export type OverlayController = {
  overlayAudio: HTMLAudioElement;
  hlsRef: { current: Hls | null };
  userVolume: number;
  duckVolume: number;
  micActive: boolean;
};

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
  if (!hlsUrl) return;

  if (hlsUrl.includes('.m3u8') && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(hlsUrl);
    hls.attachMedia(overlayAudio);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (autoPlay) overlayAudio.play().catch(() => undefined);
    });
    hlsRef.current = hls;
  } else {
    overlayAudio.src = hlsUrl;
    if (autoPlay) overlayAudio.play().catch(() => undefined);
  }
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

  controller.overlayAudio.src = clipUrl;
  await controller.overlayAudio.play().catch(() => undefined);

  await new Promise((r) => setTimeout(r, Math.min(30000, durationSeconds * 1000)));

  controller.overlayAudio.pause();
  controller.overlayAudio.removeAttribute('src');
  controller.micActive = prevMic;
  if (mainAudio) applyDuckToMain(mainAudio, userVolume, controller);
}
