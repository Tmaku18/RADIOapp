'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import { FrequencyVisualizer } from '@/components/radio/FrequencyVisualizer';
import { RadioUpNextQueue } from '@/components/radio/RadioUpNextQueue';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { Button } from '@/components/ui/button';
import { ButterflyPulseOverlay } from '@/components/radio/ButterflyPulseOverlay';
import { Reveal } from '@/components/dimension/Reveal';
import { DEFAULT_STATION_ID, getStationById } from '@/data/station-map';
import { getLastRadioStationId } from '@/lib/playback-preferences';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type RisingStarStationEvent = {
  payload?: {
    songTitle?: string;
    artistName?: string;
    conversion?: number;
  };
};

export type RadioListenExperienceProps = {
  /** When set, skips ?station= URL param resolution. */
  radioId?: string;
  autoplay?: boolean;
  /** Hide change-station control when null. */
  changeStationHref?: string | null;
  /** Use plain anchor for cross-origin station picker (Pro-Networx host). */
  changeStationExternal?: boolean;
};

function resolveStationId(stationParam: string | null): string {
  const fallback = getLastRadioStationId() || DEFAULT_STATION_ID;
  if (!stationParam) return fallback;
  const trimmed = stationParam.trim().toLowerCase();
  if (!trimmed) return fallback;

  const normalized = trimmed.replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  if (getStationById(normalized)) return normalized;
  if (getStationById(trimmed)) return trimmed;
  return fallback;
}

export function RadioListenExperience({
  radioId: radioIdProp,
  autoplay: autoplayProp,
  changeStationHref: changeStationHrefProp,
  changeStationExternal = false,
}: RadioListenExperienceProps = {}) {
  const searchParams = useSearchParams();
  const playback = usePlaybackOptional();
  const stationParam = searchParams.get('station');
  const autoplayFromUrl = searchParams.get('autoplay') === '1';
  const autoplay = autoplayProp ?? autoplayFromUrl;

  const resolvedStationId = useMemo(
    () => (radioIdProp?.trim() ? radioIdProp.trim() : resolveStationId(stationParam)),
    [radioIdProp, stationParam],
  );

  const [risingStar, setRisingStar] = useState<{ title: string; body: string } | null>(null);
  const [pulseActive, setPulseActive] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const currentStation = getStationById(resolvedStationId) ?? null;
  const switcherStationId =
    playback?.state.source === 'radio' && playback.state.track?.radioId?.trim()
      ? playback.state.track.radioId.trim()
      : resolvedStationId;

  const changeStationHref =
    changeStationHrefProp === undefined
      ? `/discover?tab=station&station=${encodeURIComponent(switcherStationId)}`
      : changeStationHrefProp;

  const isPlaying =
    (playback?.state.isPlaying ?? false) &&
    !playback?.state.pausedAt &&
    !playback?.state.isMuted;
  const hasStream = !!playback?.state.track?.audioUrl;

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const channel = supabase
      .channel('station-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'station_events',
          filter: 'type=eq.rising_star',
        },
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

  const changeStationClassName =
    'px-4 py-2 rounded-full border border-cyan-400/40 text-cyan-300 font-dim-mono text-[10px] tracking-[0.25em] uppercase hover:bg-cyan-400 hover:text-black flex items-center gap-2';

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden" data-dimension>
      <ButterflyPulseOverlay active={pulseActive} />

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-5 pb-28">
          <Reveal>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-500" />
                  <span className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400">
                    ON AIR · {currentStation?.genre?.toUpperCase() ?? 'THE REFINERY'}
                  </span>
                </div>
                <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
                  Live <span className="text-glow-cyan text-cyan-300">radio</span>
                </h1>
              </div>
              {changeStationHref ? (
                changeStationExternal ? (
                  <a
                    href={changeStationHref}
                    data-testid="change-station"
                    className={changeStationClassName}
                  >
                    Change station <ChevronRight className="w-3 h-3" />
                  </a>
                ) : (
                  <Link
                    href={changeStationHref}
                    data-testid="change-station"
                    className={changeStationClassName}
                  >
                    Change station <ChevronRight className="w-3 h-3" />
                  </Link>
                )
              ) : null}
            </div>
          </Reveal>

          {risingStar && (
            <div className="rounded-xl glass border border-cyan-400/30 px-3 py-2">
              <div className="text-xs uppercase tracking-widest text-cyan-300 font-dim-mono">
                Butterfly Ripple
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">{risingStar.title}</div>
              <div className="text-sm text-white/60 mt-0.5">{risingStar.body}</div>
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
            <div className="space-y-5 min-w-0">
              <Reveal>
                <div
                  data-testid="player-hero"
                  className="relative rounded-3xl glass overflow-hidden"
                >
                  <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
                  <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

                  <RadioPlayer
                    radioId={resolvedStationId}
                    autoplay={autoplay}
                    layout="dimension"
                    cardClassName="relative z-10"
                  />

                  <div className="relative z-10 border-t border-white/10 bg-black/40 px-6 md:px-8 py-5">
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

              <RadioUpNextQueue radioId={resolvedStationId} />
            </div>

            <Reveal delay={0.1} className="hidden lg:block sticky top-4">
              <div className="rounded-2xl glass overflow-hidden min-h-[480px] h-[calc(100vh-12rem)] max-h-[720px] flex flex-col">
                <ChatSidebar radioId={resolvedStationId} dimensionChrome />
              </div>
            </Reveal>
          </div>

          <div className="text-center lg:hidden">
            <Button
              variant="outline"
              className="bg-card/70 backdrop-blur"
              onClick={() => setShowChat(!showChat)}
            >
              <span className="mr-2">💬</span>
              {showChat ? 'Leave the Room' : 'Enter the Room'}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`${
          showChat ? 'fixed inset-0 z-40 flex' : 'hidden'
        } lg:hidden h-full w-full bg-black/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
      >
        <div className="flex-1 min-h-0 h-full p-3">
          <div className="rounded-2xl glass overflow-hidden h-full flex flex-col">
            <ChatSidebar
              radioId={resolvedStationId}
              onExitMobile={() => setShowChat(false)}
              dimensionChrome
            />
          </div>
        </div>
      </div>
    </div>
  );
}
