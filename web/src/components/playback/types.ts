/**
 * Unified playback types for global PlaybackProvider.
 * Single audio session: only one source (radio | discography | refinery) plays at a time.
 */

export type PlaybackSource = 'radio' | 'discography' | 'refinery' | null;

export interface PlaybackTrack {
  id: string;
  title: string;
  artistName: string;
  artistOriginCity?: string | null;
  artistOriginState?: string | null;
  artistId?: string | null;
  /** Radio: station id this track belongs to */
  radioId?: string | null;
  artworkUrl: string | null;
  audioUrl: string;
  durationSeconds: number;
  /** Radio: play id for voting */
  playId?: string | null;
}

export interface PlaybackState {
  source: PlaybackSource;
  track: PlaybackTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  /** Radio: server position for True Radio sync */
  serverPosition: number;
  /** Radio: timestamp when paused (soft pause) */
  pausedAt: number | null;
  /** Radio: synced to live */
  isLive: boolean;
}

export const initialPlaybackState: PlaybackState = {
  source: null,
  track: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isLoading: false,
  error: null,
  serverPosition: 0,
  pausedAt: null,
  isLive: true,
};
