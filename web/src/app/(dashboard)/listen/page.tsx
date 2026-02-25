'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { RadioPlayer } from '@/components/radio/RadioPlayer';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { VenueAdSlot } from '@/components/radio/VenueAdSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ButterflyPulseOverlay } from '@/components/radio/ButterflyPulseOverlay';

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
  const [showChat, setShowChat] = useState(true);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [risingStar, setRisingStar] = useState<{ title: string; body: string } | null>(null);
  const [pulseActive, setPulseActive] = useState(false);

  const handleAmplifyClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left - 24, y: e.clientY - rect.top - 24 });
    setTimeout(() => setRipple(null), 600);
  }, []);

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
          const songTitle = p.songTitle ?? 'an ore';
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
    <div className="flex min-h-0 flex-1">
      <ButterflyPulseOverlay active={pulseActive} />
      <div className="flex-1 min-h-0 overflow-y-auto p-8">
        <div className="min-h-full flex flex-col items-center justify-center">
        <div className="max-w-lg w-full">
          {risingStar && (
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-primary/90">Butterfly Ripple</div>
              <div className="text-sm font-semibold text-foreground mt-1">{risingStar.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{risingStar.body}</div>
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">Now Playing</h1>
            <p className="text-muted-foreground">Discover underground artists on RadioApp</p>
          </div>

          <div className="relative">
            <div className="listener-glow absolute -inset-10 blur-3xl opacity-80 pointer-events-none" />
            <Card className="relative now-playing-deck">
              <CardContent className="pt-6">
                <RadioPlayer />
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="amplify-ripple-container relative inline-block">
              <Button asChild size="lg" className="amplify-btn h-14 w-14 rounded-full p-0 text-2xl">
                <Link href="/competition" onClick={handleAmplifyClick}>
                  📢
                </Link>
              </Button>
              {ripple && (
                <span
                  className="amplify-ripple animate-ripple"
                  style={{
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: 48,
                    height: 48,
                  }}
                />
              )}
            </div>
            <p className="sr-only">Amplify — vote for tracks</p>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Everyone listening hears the same stream. Send a ripple (like) to like an ore and support the artist.</p>
          </div>

          <div className="mt-4 text-center lg:hidden">
            <Button onClick={() => setShowChat(!showChat)}>
              <span className="mr-2">💬</span>
              {showChat ? 'Leave the Room' : 'Enter the Room'}
            </Button>
          </div>
        </div>
        </div>
      </div>

      <div className={`${showChat ? 'flex flex-col' : 'hidden'} lg:flex flex-col min-w-0`}>
        <div className="p-2 border-b border-border shrink-0">
          <VenueAdSlot className="w-full" />
        </div>
        <div className="flex-1 min-h-0">
          <ChatSidebar />
        </div>
      </div>
    </div>
  );
}
