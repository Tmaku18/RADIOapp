'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Headphones, Heart } from 'lucide-react';
import type { TrendingArtist } from '@/components/marketing/TrendingShowcase';
import { resolveListens } from '@/lib/analytics-metrics';
import { useArtistProfileHref } from '@/hooks/useArtistProfileHref';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function ParallaxArtistCard({
  artist,
  index,
}: {
  artist: TrendingArtist;
  index: number;
}) {
  const profileHref = useArtistProfileHref(artist.id);
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [12, -12]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-14, 14]), { stiffness: 180, damping: 18 });
  const shineX = useTransform(mx, [0, 1], ['0%', '100%']);
  const shineY = useTransform(my, [0, 1], ['0%', '100%']);
  const cyanShine = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(420px circle at ${x} ${y}, rgba(0,240,255,0.35), transparent 55%)`,
  );
  const pinkShine = useTransform(
    [shineX, shineY],
    ([x, y]) =>
      `radial-gradient(260px circle at ${x} ${y}, rgba(255,0,127,0.35), transparent 60%)`,
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

  return (
    <Link href={profileHref} className="shrink-0">
      <motion.div
        ref={ref}
        data-testid={`catalyst-card-${index}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          rotateX: rx,
          rotateY: ry,
          transformPerspective: 900,
          transformStyle: 'preserve-3d',
        }}
        className="relative w-[280px] md:w-[340px] h-[440px] md:h-[520px] rounded-2xl glass overflow-hidden cursor-pointer will-change-transform"
      >
        <div className="absolute inset-0">
          {artist.avatarUrl ? (
            <img
              src={artist.avatarUrl}
              alt={artist.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-400/15 via-black to-pink-500/15 flex items-center justify-center">
              <span className="font-unbounded font-black text-[160px] text-white/10">
                {artist.displayName[0]}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </div>

        <motion.div
          className="pointer-events-none absolute inset-0 mix-blend-screen opacity-60"
          style={{ background: cyanShine }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 mix-blend-screen opacity-50"
          style={{ background: pinkShine }}
        />

        <div
          className="absolute top-4 left-5 font-dim-mono text-[10px] tracking-[0.3em] text-white/70"
          style={{ transform: 'translateZ(40px)' }}
        >
          #{String(index + 1).padStart(2, '0')} / GEM
        </div>

        <div
          className="absolute bottom-5 left-5 right-5"
          style={{ transform: 'translateZ(60px)' }}
        >
          <div className="font-unbounded font-black text-3xl md:text-4xl tracking-tight text-glow-cyan text-white">
            {artist.displayName}
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Headphones className="w-3.5 h-3.5" /> {formatCount(resolveListens(artist))} listens
            </span>
            <span className="flex items-center gap-1.5 text-pink-400">
              <Heart className="w-3.5 h-3.5" /> {formatCount(artist.likeCount)}
            </span>
          </div>
        </div>

        <div className="absolute inset-0 rounded-2xl ring-1 ring-cyan-400/20 pointer-events-none" />
      </motion.div>
    </Link>
  );
}
