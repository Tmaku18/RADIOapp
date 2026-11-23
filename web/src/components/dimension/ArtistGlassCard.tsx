'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Headphones, Heart, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ArtistGlassCardData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  headline?: string | null;
  songCount?: number;
  likeCount?: number;
  listens?: number;
  earsReached?: number;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function ArtistGlassCard({
  artist,
  href,
  index = 0,
  className,
  footer,
}: {
  artist: ArtistGlassCardData;
  href: string;
  index?: number;
  className?: string;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [10, -10]), {
    stiffness: 180,
    damping: 18,
  });
  const ry = useSpring(useTransform(mx, [0, 1], [-12, 12]), {
    stiffness: 180,
    damping: 18,
  });
  const shineX = useTransform(mx, [0, 1], ['0%', '100%']);
  const shineY = useTransform(my, [0, 1], ['0%', '100%']);
  const cyanShine = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(360px circle at ${x} ${y}, rgba(0,240,255,0.32), transparent 55%)`,
  );
  const pinkShine = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(240px circle at ${x} ${y}, rgba(255,0,127,0.3), transparent 60%)`,
  );

  const onMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const onMouseLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  const listens = artist.listens ?? artist.earsReached ?? 0;
  const likes = artist.likeCount ?? 0;
  const songs = artist.songCount ?? 0;
  const name = artist.displayName?.trim() || 'Artist';

  return (
    <div className={cn('relative', className)}>
      <Link href={href} className="block">
        <motion.div
          ref={ref}
          data-testid={`artist-glass-card-${index}`}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{
            rotateX: rx,
            rotateY: ry,
            transformPerspective: 900,
            transformStyle: 'preserve-3d',
          }}
          className="relative aspect-[3/4] w-full rounded-2xl glass overflow-hidden cursor-pointer will-change-transform border border-white/10"
        >
          <div className="absolute inset-0">
            {artist.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.avatarUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-cyan-400/15 via-black to-pink-500/15 flex items-center justify-center">
                <span className="font-unbounded font-black text-[120px] text-white/10">
                  {name[0]?.toUpperCase() || 'A'}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
          </div>

          <motion.div
            className="pointer-events-none absolute inset-0 mix-blend-screen opacity-60"
            style={{ background: cyanShine }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 mix-blend-screen opacity-50"
            style={{ background: pinkShine }}
          />

          <div className="absolute top-4 left-5 font-dim-mono text-[10px] tracking-[0.3em] text-white/70">
            #{String(index + 1).padStart(2, '0')} / GEM
          </div>

          <div className="absolute bottom-5 left-5 right-5">
            <div className="font-unbounded font-black text-2xl md:text-3xl tracking-tight text-glow-cyan text-white line-clamp-2">
              {name}
            </div>
            {artist.headline ? (
              <p className="mt-1 text-sm text-white/60 line-clamp-1">
                {artist.headline}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Headphones className="w-3.5 h-3.5" /> {formatCount(listens)}
              </span>
              <span className="flex items-center gap-1.5 text-pink-400">
                <Heart className="w-3.5 h-3.5" /> {formatCount(likes)}
              </span>
              <span className="flex items-center gap-1.5 text-white/70">
                <Music2 className="w-3.5 h-3.5" /> {formatCount(songs)}
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
      {footer ? (
        <div className="mt-3 flex flex-wrap gap-2">{footer}</div>
      ) : null}
    </div>
  );
}
