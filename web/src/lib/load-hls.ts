import type Hls from 'hls.js';

export type HlsConstructor = typeof Hls;

let loading: Promise<HlsConstructor> | null = null;

/** Load hls.js only when a non-native stream actually needs it. */
export function loadHls(): Promise<HlsConstructor> {
  if (!loading) {
    loading = import('hls.js').then((mod) => mod.default);
  }
  return loading;
}
