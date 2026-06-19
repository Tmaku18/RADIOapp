'use client';

import Image from 'next/image';
import { Flame, Headphones, Heart } from 'lucide-react';
import type { TrendingSong } from '@/components/marketing/TrendingShowcase';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type DimensionSongCardProps = {
  song: TrendingSong;
  index: number;
  playing?: boolean;
  onPlay?: () => void;
};

export function DimensionSongCard({ song, index, playing, onPlay }: DimensionSongCardProps) {
  const hasClip = Boolean(song.clipUrl);

  return (
    <button
      type="button"
      data-testid={`song-card-${song.id}`}
      className="tilt group relative rounded-xl overflow-hidden glass cursor-pointer text-left w-full"
      onClick={hasClip ? onPlay : undefined}
      disabled={!hasClip}
    >
      <div className="aspect-square relative overflow-hidden">
        {song.artworkUrl ? (
          <Image
            src={song.artworkUrl}
            alt={song.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-pink-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        {hasClip && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-12 h-12 rounded-full glass flex items-center justify-center text-cyan-300">
              {playing ? '❚❚' : '▶'}
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur border border-cyan-400/30">
          <Flame className="w-3 h-3 text-orange-400" />
          <span className="font-dim-mono text-[10px] font-bold text-cyan-300">
            {song.temperaturePercent}°
          </span>
        </div>
        <div className="absolute top-3 right-3 font-dim-mono text-[9px] tracking-[0.2em] text-white/60">
          #{String(index + 1).padStart(2, '0')}
        </div>
      </div>
      <div className="p-4">
        <div className="font-unbounded font-bold text-sm truncate text-white">{song.title}</div>
        <div className="font-dim-mono text-[11px] text-white/50 mt-0.5">{song.artistName}</div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1 text-white/60 text-xs">
            <Headphones className="w-3 h-3" /> {formatCount(song.earsReached)}
          </div>
          <div className="flex items-center gap-1 text-pink-400 text-xs">
            <Heart className="w-3 h-3" /> {formatCount(song.likeCount)}
          </div>
        </div>
      </div>
    </button>
  );
}
