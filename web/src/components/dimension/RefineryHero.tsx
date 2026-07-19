'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { cn } from '@/lib/utils';

const FloatingAlbum = dynamic(
  () => import('./FloatingAlbum').then((m) => m.FloatingAlbum),
  { ssr: false },
);

export function RefineryVisualizer({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-12" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="vbar w-[3px] h-full bg-gradient-to-t from-cyan-400 to-pink-500 rounded-sm"
          style={{
            animationDelay: `${(i * 0.07) % 1}s`,
            animationDuration: `${0.6 + (i % 5) * 0.1}s`,
            animationPlayState: playing ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}

type RefineryHeroProps = {
  className?: string;
  children?: React.ReactNode;
};

/** Glass refinery chrome around the listen player — preserves RadioPlayer logic in children. */
export function RefineryHero({ className, children }: RefineryHeroProps) {
  const playback = usePlaybackOptional();
  const track = playback?.state.track;
  const isPlaying = (playback?.state.isPlaying ?? false) && !playback?.state.pausedAt;
  const showAsPlaying = isPlaying && !playback?.state.isMuted;
  const artwork = track?.artworkUrl?.trim() || null;

  return (
    <div className={cn('space-y-4', className)} data-dimension>
      <div className="mb-2">
        <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-1">
          ◤ THE REFINERY
        </div>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-2xl sm:text-3xl text-white">
          Live <span className="text-glow-cyan text-cyan-300">Radio</span>
        </h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <div className="rounded-2xl overflow-hidden glass relative aspect-square lg:aspect-auto lg:min-h-[320px]">
            <div className="absolute inset-0 cyber-grid opacity-40" />
            {artwork ? (
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-white/40 font-dim-mono text-xs">
                    Loading 3D…
                  </div>
                }
              >
                <FloatingAlbum key={artwork} imgUrl={artwork} />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-cyan-400/30 bg-cyan-400/5 animate-pulse" />
              </div>
            )}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="live-dot inline-block w-2 h-2 rounded-full bg-pink-500" />
              <span className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400">ON AIR</span>
            </div>
            {track && (
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-dim-mono text-[10px] tracking-[0.25em] text-cyan-300 mb-1">
                    NOW PLAYING
                  </div>
                  <div className="font-unbounded font-black text-lg sm:text-2xl tracking-tight text-white truncate">
                    {track.title}
                  </div>
                  <div className="text-white/60 text-sm truncate">{track.artistName}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl glass p-4 sm:p-5">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
              CONTROL ROOM
            </div>
            <RefineryVisualizer playing={showAsPlaying} />
            {track && (
              <div className="mt-4 font-dim-mono text-[10px] tracking-wider text-white/50 uppercase">
                {track.artistName}
                {track.artistOriginCity || track.artistOriginState
                  ? ` · ${[track.artistOriginCity, track.artistOriginState].filter(Boolean).join(', ')}`
                  : ''}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
