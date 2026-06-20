'use client';

import { useEffect, useState } from 'react';
import { radioApi } from '@/lib/api';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';
import { Reveal } from '@/components/dimension/Reveal';

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
  const [tracks, setTracks] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadError(false);
        const res = await radioApi.getUpcomingQueue(radioId, 12);
        if (!cancelled) {
          setTracks(Array.isArray(res.data) ? res.data : []);
        }
      } catch {
        if (!cancelled) {
          setTracks([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [radioId]);

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
