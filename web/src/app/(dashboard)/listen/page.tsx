'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import { FrequencyVisualizer } from '@/components/radio/FrequencyVisualizer';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { Button } from '@/components/ui/button';
import { ButterflyPulseOverlay } from '@/components/radio/ButterflyPulseOverlay';
import { Reveal } from '@/components/dimension/Reveal';
import { DEFAULT_STATION_ID, getStationById } from '@/data/station-map';
import { resolveTrackArtworkUrl } from '@/lib/media-artwork';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type RisingStarStationEvent = {
  payload?: {
    songTitle?: string;
    artistName?: string;
    conversion?: number;
  };
};

export default function ListenPage() {
  const searchParams = useSearchParams();
  const playback = usePlaybackOptional();
  const bassRef = playback?.bassRef;
  const stationId = searchParams.get('station');
  const autoplay = searchParams.get('autoplay') === '1';
  const resolvedStationId = useMemo(() => {
    const fallback = DEFAULT_STATION_ID;
    if (!stationId) return fallback;
    const trimmed = stationId.trim().toLowerCase();
    if (!trimmed) return fallback;

    const normalized = trimmed
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');

    if (getStationById(normalized)) return normalized;
    if (getStationById(trimmed)) return trimmed;
    return fallback;
  }, [stationId]);
  const [risingStar, setRisingStar] = useState<{ title: string; body: string } | null>(null);
  const [pulseActive, setPulseActive] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const heroArtRef = useRef<HTMLDivElement>(null);

  const currentStation = getStationById(resolvedStationId) ?? null;
  const switcherStationId =
    playback?.state.source === 'radio' && playback.state.track?.radioId?.trim()
      ? playback.state.track.radioId.trim()
      : resolvedStationId;

  const isPlaying =
    (playback?.state.isPlaying ?? false) &&
    !playback?.state.pausedAt &&
    !playback?.state.isMuted;
  const hasStream = !!playback?.state.track?.audioUrl;
  const artworkUrl = playback?.state.track?.artworkUrl
    ? resolveTrackArtworkUrl(playback.state.track.artworkUrl)
    : null;

  useEffect(() => {
    let raf = 0;
    let smoothed = 0;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      smoothed = smoothed * 0.7 + b * 0.3;
      const i = Math.min(1, smoothed * 1.6);
      if (heroArtRef.current) {
        heroArtRef.current.style.boxShadow = `0 0 ${20 + i * 60}px rgba(0,240,255,${0.3 + i * 0.55}), 0 0 ${50 + i * 120}px rgba(255,0,127,${0.08 + i * 0.35})`;
        heroArtRef.current.style.transform = `scale(${1 + i * 0.03})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const channel = supabase
      .channel('station-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'station_events', filter: 'type=eq.rising_star' },
        (payload) => {
          const row = payload.new as RisingStarStationEvent;
          const p = row?.payload ?? {};
          const songTitle = p.songTitle ?? 'a song';
          const artistName = p.artistName ?? 'an artist';
          const conversion = typeof p.conversion === 'number' ? p.conversion : null;
          setRisingStar({
            title: 'Rising Star',
            body: `${artistName} just hit ${conversion != null ? (conversion * 100).toFixed(1) : '5'}% conversion on “${songTitle}”.`,
          });
          setPulseActive(true);
          setTimeout(() => setPulseActive(false), 1100);
          setTimeout(() => setRisingStar(null), 8000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden" data-dimension>
      <ButterflyPulseOverlay active={pulseActive} />
      <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3 lg:p-4 [overflow-anchor:none]">
        <div className="h-full flex flex-col items-center">
          <div className="max-w-5xl w-full h-full min-h-0 flex flex-col overscroll-contain pr-1 [overflow-anchor:none] space-y-4">
            <Reveal>
              <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-500" />
                    <span className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400">
                      ON AIR · {currentStation?.genre?.toUpperCase() ?? 'THE REFINERY'}
                    </span>
                  </div>
                  <h1 className="font-unbounded font-black tracking-tighter uppercase text-2xl md:text-4xl">
                    Live <span className="text-glow-cyan text-cyan-300">radio</span>
                  </h1>
                </div>
                <Link
                  href={`/discover?tab=station&station=${encodeURIComponent(switcherStationId)}`}
                  data-testid="change-station"
                  className="px-4 py-2 rounded-full border border-cyan-400/40 text-cyan-300 font-dim-mono text-[10px] tracking-[0.25em] uppercase hover:bg-cyan-400 hover:text-black flex items-center gap-2"
                >
                  Change station <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </Reveal>

            {risingStar && (
              <div className="rounded-xl glass border border-cyan-400/30 px-3 py-2 shrink-0">
                <div className="text-xs uppercase tracking-widest text-cyan-300 font-dim-mono">Butterfly Ripple</div>
                <div className="text-sm font-semibold text-white mt-0.5">{risingStar.title}</div>
                <div className="text-sm text-white/60 mt-0.5">{risingStar.body}</div>
              </div>
            )}

            <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start flex-1 min-h-0">
              <Reveal>
                <div
                  data-testid="player-hero"
                  className="relative rounded-3xl glass overflow-hidden flex flex-col min-h-0"
                >
                  <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
                  <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

                  {artworkUrl && (
                    <div className="relative p-6 pb-0 flex justify-center md:justify-start">
                      <div
                        ref={heroArtRef}
                        className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden ring-1 ring-cyan-400/30 shrink-0 transition-[box-shadow,transform] duration-75 will-change-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic artwork URL */}
                        <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        {isPlaying && (
                          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/70 border border-pink-400/40 backdrop-blur">
                            <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-500" />
                            <span className="font-dim-mono text-[9px] tracking-[0.25em] text-pink-400">ON AIR</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="relative flex-1 min-h-0 overflow-y-auto p-2 sm:p-3">
                    <RadioPlayer
                      radioId={resolvedStationId}
                      autoplay={autoplay}
                      cardClassName="py-0 gap-2 border-0 bg-transparent shadow-none"
                    />
                  </div>

                  <div className="relative border-t border-white/10 bg-black/40 px-4 sm:px-6 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-3 font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300">
                        <span>FREQUENCY VISUALIZER</span>
                        {hasStream ? (
                          <span className="flex items-center gap-1 text-cyan-300/60">
                            <Wifi className="w-3 h-3" /> LIVE FFT
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-white/40">
                            <WifiOff className="w-3 h-3" /> STANDBY
                          </span>
                        )}
                      </div>
                      <div className="font-dim-mono text-[10px] tracking-[0.25em] text-white/40">
                        {isPlaying ? 'TRANSMITTING ◆' : 'STANDBY ◆'}
                      </div>
                    </div>
                    <FrequencyVisualizer playing={isPlaying} />
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.1} className="hidden lg:block h-full min-h-[320px]">
                <div className="rounded-2xl glass overflow-hidden flex flex-col h-full min-h-[320px]">
                  <ChatSidebar radioId={resolvedStationId} />
                </div>
              </Reveal>
            </div>

            <div className="text-center lg:hidden shrink-0">
              <Button variant="outline" className="bg-card/70 backdrop-blur" onClick={() => setShowChat(!showChat)}>
                <span className="mr-2">💬</span>
                {showChat ? 'Leave the Room' : 'Enter the Room'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`${
          showChat ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:hidden h-full max-h-full min-w-0 shrink-0 w-full border-l border-border/40 bg-black/25 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="flex-1 min-h-0 h-full">
          <ChatSidebar
            radioId={resolvedStationId}
            onExitMobile={() => setShowChat(false)}
          />
        </div>
      </div>
    </div>
  );
}
