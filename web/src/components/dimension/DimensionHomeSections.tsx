'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Flame, Headphones, Pickaxe } from 'lucide-react';
import { DimensionCanvas } from './DimensionCanvas';
import { Reveal } from './Reveal';
import { DimensionSongCard } from './DimensionSongCard';
import { PlatformLiveStats } from '@/components/marketing/PlatformLiveStats';
import type { TrendingData } from '@/components/marketing/TrendingShowcase';
import { useAuth } from '@/contexts/AuthContext';
import { resolveArtistProfileHref } from '@/lib/artist-links';

type HomeStats = {
  totalUsers: number;
  totalSongs: number;
  totalLikes: number;
  liveListeners: number;
  listens: number;
  earsReached: number;
};

import { ANALYTICS_METRICS, formatMetricCount, resolveListens } from '@/lib/analytics-metrics';

export function DimensionHomeSections({
  stats,
  trending,
}: {
  stats: HomeStats;
  trending: TrendingData;
}) {
  const { profile } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;
    const onEnded = () => setPlayingId(null);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const togglePlay = (songId: string, clipUrl: string | null) => {
    if (!clipUrl || !audioRef.current) return;
    const audio = audioRef.current;
    if (playingId === songId) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    document.querySelectorAll('audio').forEach((el) => {
      if (el !== audio) el.pause();
    });
    audio.src = clipUrl;
    audio.play().catch(() => setPlayingId(null));
    setPlayingId(songId);
  };

  const avgTemp = trending.temperature.average;

  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[calc(100vh-5rem)] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <DimensionCanvas />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black pointer-events-none" />
          <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-32 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
                <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-pink-500" />
                <span className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400">
                  BROADCASTING NOW
                </span>
                <span className="font-dim-mono text-[10px] text-white/50">
                  · {stats.liveListeners} listeners
                </span>
              </div>
            </Reveal>

            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl lg:text-8xl leading-[0.9] text-white">
              <Reveal as="span" delay={0.05} className="block">
                Join the
              </Reveal>
              <Reveal as="span" delay={0.18} className="block text-glow-cyan text-cyan-300">
                movement.
              </Reveal>
              <Reveal as="span" delay={0.32} className="block">
                Build your
              </Reveal>
              <Reveal
                as="span"
                delay={0.48}
                className="block glitch text-glow-pink"
                data-text="network."
              >
                network.
              </Reveal>
            </h1>

            <Reveal delay={0.7}>
              <p className="mt-8 max-w-xl text-white/70 text-lg leading-relaxed">
                Whether you are a hidden gem ready to be heard, a Prospector discovering new
                talent, or a pro ready to mentor — Networx is the underground frequency where
                careers begin.
              </p>
            </Reveal>

            <Reveal delay={0.85}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/listen"
                  className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-cyan-400 text-black font-dim-mono text-[12px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
                >
                  <Pickaxe className="w-4 h-4" />
                  Mine The Frequency
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-3 px-7 py-4 rounded-full border border-white/20 text-white font-dim-mono text-[12px] tracking-[0.25em] uppercase hover:border-pink-400 hover:text-pink-400 transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
            </Reveal>

            <div className="mt-14 grid grid-cols-3 max-w-lg gap-6">
              {[
                { v: formatMetricCount(stats.totalUsers), l: 'Members' },
                { v: formatMetricCount(stats.totalSongs), l: 'Songs' },
                { v: formatMetricCount(stats.totalLikes), l: 'Ripples' },
              ].map((s, i) => (
                <Reveal key={s.l} delay={1 + i * 0.1}>
                  <div className="font-unbounded font-black text-3xl text-white">{s.v}</div>
                  <div className="font-dim-mono text-[10px] tracking-[0.3em] text-white/50 uppercase">
                    {s.l}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-dim-mono text-[10px] tracking-[0.4em] text-white/30 animate-pulse">
          SCROLL ▾
        </div>

        <div className="hidden lg:flex absolute bottom-10 right-10 items-center gap-3 px-4 py-2 rounded-full glass animate-pulse pointer-events-none">
          <span className="text-cyan-300 text-base">🦋</span>
          <span className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300">
            CLICK THE BUTTERFLY
          </span>
        </div>
      </section>

      {/* TRENDING NOW */}
      {trending.songs.length > 0 && (
        <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24" id="trending">
          <Reveal>
            <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
              <div>
                <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                  ◤ SECTION 01 — GEMS &amp; DIAMONDS
                </div>
                <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-5xl text-white">
                  Trending <span className="text-glow-pink text-pink-400">now</span>
                </h2>
                <p className="text-white/60 mt-3 max-w-lg">
                  The songs the people are voting up right now. Tap play to hear a clip.
                </p>
              </div>
              <div className="flex items-center gap-6 font-dim-mono text-[10px] tracking-[0.25em] text-white/60">
                <div className="flex items-center gap-2">
                  <Flame className="w-3 h-3 text-orange-400" /> AVG {Math.round(avgTemp)}°
                </div>
                <div className="flex items-center gap-2">
                  <Headphones className="w-3 h-3 text-cyan-300" /> {formatMetricCount(stats.listens)}{' '}
                  {ANALYTICS_METRICS.listens.label.toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  <Headphones className="w-3 h-3 text-yellow-300" /> {formatMetricCount(stats.earsReached)}{' '}
                  EARS
                </div>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {trending.songs.map((s, i) => (
              <Reveal key={s.id} delay={(i % 4) * 0.08} y={36}>
                <DimensionSongCard
                  song={s}
                  index={i}
                  playing={playingId === s.id}
                  onPlay={() => togglePlay(s.id, s.clipUrl)}
                />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* TRENDING ARTISTS — marquee */}
      {trending.artists.length > 0 && (
        <section className="relative z-10 py-20 border-y border-white/5 overflow-hidden">
          <Reveal>
            <div className="max-w-7xl mx-auto px-6 lg:px-10 mb-10">
              <div className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">
                ◤ SECTION 02 — CATALYSTS
              </div>
              <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-5xl text-white">
                Trending <span className="text-glow-cyan text-cyan-300">artists</span>
              </h2>
            </div>
          </Reveal>
          <div className="marquee gap-5 px-6">
            {[...trending.artists, ...trending.artists].map((a, i) => (
              <Link
                key={`${a.id}-${i}`}
                href={resolveArtistProfileHref(a.id, !!profile)}
                className="tilt shrink-0 w-56 rounded-xl glass p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-cyan-400/20 to-pink-500/20 border border-white/10 flex items-center justify-center shrink-0">
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} alt={a.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-unbounded font-black text-white">{a.displayName[0]}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-unbounded font-bold text-sm truncate text-white">
                    {a.displayName}
                  </div>
                  <div className="font-dim-mono text-[10px] text-white/50">
                    🎧 {formatMetricCount(resolveListens(a))} · ♥ {formatMetricCount(a.likeCount)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* LIVE RADIO */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <Reveal>
          <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
            ◤ SECTION 03 — LIVE FREQUENCY
          </div>
          <h2 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl text-white mb-8">
            Radio <span className="text-glow-cyan text-cyan-300">now</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl">
          <PlatformLiveStats
            initialLiveListeners={stats.liveListeners}
            initialListens={stats.listens}
            initialEarsReached={stats.earsReached}
          />
        </div>
      </section>
    </>
  );
}
