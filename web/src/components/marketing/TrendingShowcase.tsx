'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';

export type TrendingSong = {
  id: string;
  title: string;
  artistId: string | null;
  artistName: string;
  artworkUrl: string | null;
  clipUrl: string | null;
  clipDurationSeconds: number;
  durationSeconds: number | null;
  likeCount: number;
  playCount: number;
  earsReached: number;
  temperaturePercent: number;
};

export type TrendingArtist = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  songCount: number;
  likeCount: number;
  playCount: number;
};

export type TrendingData = {
  songs: TrendingSong[];
  artists: TrendingArtist[];
  temperature: { average: number; top: number };
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function tempColor(t: number): string {
  if (t >= 75) return 'text-orange-500';
  if (t >= 50) return 'text-amber-500';
  return 'text-sky-500';
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function TrendingShowcase({ data }: { data: TrendingData }) {
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

  const togglePlay = (song: TrendingSong) => {
    const audio = audioRef.current;
    if (!audio || !song.clipUrl) return;
    if (playingId === song.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = song.clipUrl;
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => setPlayingId(song.id))
      .catch(() => setPlayingId(null));
  };

  if (data.songs.length === 0) return null;

  return (
    <>
      {/* Trending Now — songs with playable Discover clips */}
      <section className="relative overflow-hidden py-16 sm:py-20 bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary-foreground"
          tile={160}
          opacity={0.12}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground tracking-tight">
                Trending Now
              </h2>
              <p className="mt-2 text-primary-foreground/80">
                The songs the people are voting up right now. Tap play to hear a clip.
              </p>
            </div>
            <Link
              href="/signup"
              className="hidden sm:inline text-sm font-medium text-primary-foreground hover:underline shrink-0"
            >
              See all
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
            {data.songs.map((song) => {
              const isPlaying = playingId === song.id;
              const playable = !!song.clipUrl;
              return (
                <div
                  key={song.id}
                  className="snap-start shrink-0 w-44 sm:w-48 group"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
                    {song.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={song.artworkUrl}
                        alt={song.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary-foreground/30 to-primary-foreground/5" />
                    )}
                    <button
                      type="button"
                      onClick={() => togglePlay(song)}
                      disabled={!playable}
                      aria-label={isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                        isPlaying
                          ? 'bg-black/40 opacity-100'
                          : 'bg-black/30 opacity-0 group-hover:opacity-100'
                      } ${playable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-lg">
                        <PlayIcon playing={isPlaying} />
                      </span>
                    </button>
                    <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold backdrop-blur">
                      <span className={tempColor(song.temperaturePercent)}>
                        🔥 {song.temperaturePercent}°
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="font-semibold text-primary-foreground truncate" title={song.title}>
                      {song.title}
                    </div>
                    <div className="text-sm text-primary-foreground/80 truncate" title={song.artistName}>
                      {song.artistName}
                    </div>
                    <div className="mt-1 text-xs text-primary-foreground/70">
                      🎧 {formatCount(song.earsReached ?? 0)} ears · ♥ {formatCount(song.likeCount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trending Artists */}
      {data.artists.length > 0 && (
        <section className="relative overflow-hidden py-16 border-b border-border">
          <ButterflyPattern
            className="absolute inset-0"
            colorClassName="text-primary"
            tile={140}
            opacity={0.1}
          />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8">
              Trending Artists
            </h2>
            <div className="flex gap-6 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
              {data.artists.map((artist) => (
                <Link
                  key={artist.id}
                  href="/signup"
                  className="snap-start shrink-0 w-28 text-center group"
                >
                  <div className="relative mx-auto h-24 w-24 rounded-full overflow-hidden bg-muted ring-2 ring-border group-hover:ring-primary transition-colors">
                    {artist.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={artist.avatarUrl}
                        alt={artist.displayName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5 text-2xl font-bold text-primary">
                        {artist.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 font-semibold text-sm text-foreground truncate" title={artist.displayName}>
                    {artist.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ♥ {formatCount(artist.likeCount)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ripples — the temperature of your sound */}
      <section className="relative overflow-hidden py-20 bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary-foreground"
          tile={160}
          opacity={0.12}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ripples: The Temperature of Your Sound
            </h2>
            <p className="text-primary-foreground/85 leading-relaxed">
              Every time your track plays, listeners vote. Fire raises the
              temperature. Honest feedback keeps it real. The higher your temp,
              the more airtime you get — transparency no other platform offers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1">
                👍 Raises temp
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1">
                👎 Honest feedback
              </span>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <TemperatureGauge value={data.temperature.average} />
          </div>
        </div>
      </section>
    </>
  );
}

function TemperatureGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const size = 220;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Average song temperature ${clamped} degrees`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-primary-foreground/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="text-orange-400"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold">{clamped}°</span>
        <span className="text-xs uppercase tracking-widest text-primary-foreground/70 mt-1">
          Avg temperature
        </span>
      </div>
    </div>
  );
}
