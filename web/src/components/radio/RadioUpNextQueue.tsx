'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { radioApi } from '@/lib/api';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';
import { Reveal } from '@/components/dimension/Reveal';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { subscribeDjBoothEvents } from '@/lib/dj-booth-listener';

type QueueTrack = {
  id: string;
  title: string;
  artist_name: string;
  artwork_url?: string | null;
  like_count?: number;
  temperature_percent?: number;
};

type RadioUpNextQueueProps = {
  radioId: string;
};

export function RadioUpNextQueue({ radioId }: RadioUpNextQueueProps) {
  const playback = usePlaybackOptional();
  const currentTrackId =
    playback?.state.source === 'radio' &&
    playback.state.track?.radioId?.trim() === radioId.trim()
      ? playback.state.track.id
      : null;
  const radioActive =
    playback?.state.source === 'radio' &&
    !!playback.state.track?.audioUrl &&
    playback.state.track?.radioId?.trim() === radioId.trim();

  const [tracks, setTracks] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const emptyWhilePlayingRef = useRef(0);

  const loadQueue = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await radioApi.getUpcomingQueue(radioId, 12);
      const rows = Array.isArray(res.data) ? res.data : [];
      const filtered = currentTrackId
        ? rows.filter((row) => row.id !== currentTrackId)
        : rows;
      setTracks(filtered);
      if (filtered.length === 0 && radioActive) {
        emptyWhilePlayingRef.current += 1;
      } else {
        emptyWhilePlayingRef.current = 0;
      }
    } catch {
      setTracks([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [currentTrackId, radioActive, radioId]);

  useEffect(() => {
    setLoading(true);
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!radioId.trim()) return;
    return subscribeDjBoothEvents(radioId, (event) => {
      if (event.type === 'queue_updated') {
        void loadQueue();
      }
    });
  }, [loadQueue, radioId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadQueue();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadQueue]);

  useEffect(() => {
    const pollMs =
      tracks.length === 0 && radioActive && emptyWhilePlayingRef.current < 12
        ? 5000
        : 60000;
    const interval = setInterval(() => {
      void loadQueue();
    }, pollMs);
    return () => clearInterval(interval);
  }, [loadQueue, radioActive, tracks.length]);

  return (
    <Reveal delay={0.15}>
      <div className="rounded-2xl glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400">
            UP NEXT IN THE QUEUE
          </div>
          <span className="font-dim-mono text-[10px] tracking-[0.25em] text-white/40">
            {loading ? '…' : `${tracks.length} TRACKS`}
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400 border-t-transparent" />
          </div>
        ) : tracks.length === 0 ? (
          <p className="text-center text-white/50 text-sm py-6">
            {loadError
              ? 'Could not load the queue right now.'
              : radioActive
                ? 'Loading upcoming tracks…'
                : 'No upcoming tracks in the rotation yet.'}
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tracks.map((track, i) => (
              <div
                key={track.id}
                data-testid={`netx-queue-${i}`}
                className="text-left tilt rounded-xl p-2.5 flex items-center gap-3 bg-black/40 border border-white/5 hover:border-cyan-400/30 transition-colors"
              >
                <ArtworkImage
                  src={resolveTrackArtworkUrl(track.artwork_url)}
                  alt=""
                  className="w-12 h-12 rounded object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-unbounded font-bold text-xs truncate text-white">
                    {track.title}
                  </div>
                  <div className="font-dim-mono text-[9px] text-white/50 truncate">
                    {track.artist_name}
                  </div>
                </div>
                <div className="font-dim-mono text-[10px] text-cyan-300 shrink-0">
                  {track.temperature_percent != null
                    ? `${Math.round(track.temperature_percent)}°`
                    : track.like_count != null
                      ? `${track.like_count}`
                      : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}
