'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import { artistLiveApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type WatchSession = {
  id: string;
  status: 'starting' | 'live' | 'ended' | 'failed' | 'scheduled';
  title?: string | null;
  playback_hls_url?: string | null;
  watch_url?: string | null;
  current_viewers?: number;
};

/** Cross-browser HLS player: uses hls.js where MSE is supported, native HLS otherwise. */
function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
      return () => {
        hls.destroy();
      };
    }

    // Safari / iOS can play HLS natively.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      const onLoaded = () => video.play().catch(() => undefined);
      video.addEventListener('loadedmetadata', onLoaded);
      return () => video.removeEventListener('loadedmetadata', onLoaded);
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="w-full rounded-lg border border-border bg-black"
      controls
      autoPlay
      playsInline
    />
  );
}

export default function WatchArtistLivePage() {
  const params = useParams<{ artistId: string }>();
  const artistId = useMemo(() => (typeof params?.artistId === 'string' ? params.artistId : ''), [params]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WatchSession | null>(null);
  const [hostRole, setHostRole] = useState<string>('artist');
  const [error, setError] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState('5');
  const [donating, setDonating] = useState(false);

  const isDj = hostRole === 'dj';

  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const watchRes = await artistLiveApi.getWatch(artistId);
        const watchSession = watchRes.data?.session ?? null;
        if (!cancelled) {
          setSession(watchSession);
          setHostRole((watchRes.data?.hostRole as string) || 'artist');
          setError(watchSession ? null : `This ${watchRes.data?.hostRole === 'dj' ? 'DJ' : 'artist'} is not live right now.`);
          setLoading(false);
        }
        if (watchSession?.id) {
          artistLiveApi.join(watchSession.id, { source: 'watch_page' }).catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load livestream right now.');
          setLoading(false);
        }
      } finally {
        if (!cancelled) timer = setTimeout(load, 15000);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [artistId]);

  if (!artistId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid host.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold">{isDj ? 'Live DJ set' : 'Watch artist live'}</h1>
        <Link href={isDj ? '/dj' : `/artist/${artistId}`}>
          <Button variant="outline" size="sm">{isDj ? 'Back to Live DJ' : 'Back to artist'}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{session?.title || (isDj ? 'Live DJ set' : 'Live session')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading stream…</p>
          ) : error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : (
            <div className="space-y-3">
              {session?.playback_hls_url ? (
                <HlsPlayer src={session.playback_hls_url} />
              ) : session?.watch_url ? (
                <iframe
                  className="w-full min-h-[420px] rounded-lg border border-border bg-black"
                  src={session.watch_url}
                  allow="autoplay; fullscreen"
                  title={isDj ? 'Live DJ set' : 'Artist livestream'}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Stream is initializing. Refresh in a few seconds.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {session?.current_viewers ?? 0} watching
              </p>
              {session?.id && (
                <div className="mt-4 rounded-lg border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Support this stream</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                    />
                    <Button
                      disabled={donating}
                      onClick={async () => {
                        if (!session?.id) return;
                        const cents = Math.max(100, Math.round((Number(donationAmount) || 0) * 100));
                        setDonating(true);
                        try {
                          const res = await artistLiveApi.createDonationIntent(session.id, { amountCents: cents });
                          const clientSecret = res.data?.clientSecret;
                          if (clientSecret) {
                            alert('Donation intent created. Mobile/web Stripe confirmation wiring is next.');
                          }
                        } finally {
                          setDonating(false);
                        }
                      }}
                    >
                      {donating ? 'Processing…' : 'Donate'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
