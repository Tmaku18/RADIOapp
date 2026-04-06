'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ButterflyPulseOverlay } from '@/components/radio/ButterflyPulseOverlay';
import { getStationById } from '@/data/station-map';

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
  const stationId = searchParams.get('station');
  const resolvedStationId = useMemo(() => {
    const fallback = 'us-rap';
    if (!stationId) return fallback;
    const trimmed = stationId.trim().toLowerCase();
    if (!trimmed) return fallback;

    // Accept legacy / malformed station query values like "us hip hop".
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

  const currentStation = getStationById(resolvedStationId) ?? null;

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
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <ButterflyPulseOverlay active={pulseActive} />
      <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3 lg:p-4 [overflow-anchor:none]">
        <div className="h-full flex flex-col items-center">
        <div className="max-w-xl w-full h-full overflow-y-auto overscroll-contain pr-1 [overflow-anchor:none]">
          {currentStation && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {currentStation.genre}
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/discover?tab=station">Change station</Link>
              </Button>
            </div>
          )}
          {risingStar && (
            <div className="mb-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <div className="text-xs uppercase tracking-widest text-primary/90">Butterfly Ripple</div>
              <div className="text-sm font-semibold text-foreground mt-1">{risingStar.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{risingStar.body}</div>
            </div>
          )}
          <div className="text-center mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Now Playing</h1>
          </div>

          <div className="relative">
            <div className="listener-glow absolute -inset-10 blur-3xl opacity-80 pointer-events-none" />
            <Card className="relative now-playing-deck">
              <CardContent className="pt-3 sm:pt-4">
                <RadioPlayer radioId={resolvedStationId} />
              </CardContent>
            </Card>
          </div>

          <div className="mt-2 text-center lg:hidden shrink-0">
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
        } lg:static lg:inset-auto lg:z-auto lg:flex h-full max-h-full min-w-0 shrink-0 w-full lg:w-[clamp(340px,32vw,520px)] border-l border-border/40 bg-black/25 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
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
