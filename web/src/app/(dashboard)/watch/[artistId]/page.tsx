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

const DONATION_PRESETS = [1, 5, 10, 20, 50];

/** Stable per-browser token so refreshes/reconnects don't inflate viewer counts. */
function getViewerToken(): string {
  if (typeof window === 'undefined') return '';
  const key = 'networx_viewer_token';
  let token = window.localStorage.getItem(key);
  if (!token) {
    token =
      (window.crypto?.randomUUID?.() as string | undefined) ||
      `vt_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(key, token);
  }
  return token;
}

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
  const artistId = useMemo(
    () => (typeof params?.artistId === 'string' ? params.artistId : ''),
    [params],
  );
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WatchSession | null>(null);
  const [hostRole, setHostRole] = useState<string>('artist');
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);

  // Donation UI state
  const [presetAmount, setPresetAmount] = useState<number | 'custom'>(5);
  const [customAmount, setCustomAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [donating, setDonating] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [donationNotice, setDonationNotice] = useState<string | null>(null);

  const isDj = hostRole === 'dj';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const status = new URLSearchParams(window.location.search).get('donation');
    if (status === 'success') {
      setDonationNotice('Thanks for the tip! Your donation went through. 🎉');
    } else if (status === 'canceled') {
      setDonationNotice('Donation canceled — no charge was made.');
    }
  }, []);

  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let beatTimer: ReturnType<typeof setInterval> | null = null;
    let viewerId: string | null = null;
    let joinedSessionId: string | null = null;
    const viewerToken = getViewerToken();

    const startHeartbeat = (sessionId: string) => {
      if (beatTimer) clearInterval(beatTimer);
      beatTimer = setInterval(async () => {
        if (!viewerId) return;
        try {
          const hb = await artistLiveApi.heartbeat(sessionId, viewerId);
          if (!cancelled && typeof hb.data?.viewers === 'number') {
            setViewers(hb.data.viewers);
          }
        } catch {
          // Ignore — the periodic refresh will resync the count.
        }
      }, 15000);
    };

    const load = async () => {
      try {
        const watchRes = await artistLiveApi.getWatch(artistId);
        const watchSession =
          (watchRes.data?.session as WatchSession | null) ?? null;
        if (!cancelled) {
          setSession(watchSession);
          setHostRole((watchRes.data?.hostRole as string) || 'artist');
          setError(
            watchSession
              ? null
              : `This ${watchRes.data?.hostRole === 'dj' ? 'DJ' : 'artist'} is not live right now.`,
          );
          setLoading(false);
          if (typeof watchSession?.current_viewers === 'number') {
            setViewers(watchSession.current_viewers);
          }
        }
        // Join exactly once per session, then keep presence via heartbeats.
        if (watchSession?.id && joinedSessionId !== watchSession.id) {
          joinedSessionId = watchSession.id;
          try {
            const jr = await artistLiveApi.join(watchSession.id, {
              source: 'watch_page',
              viewerToken,
            });
            viewerId = jr.data?.viewerId ?? null;
            if (!cancelled && typeof jr.data?.viewers?.current === 'number') {
              setViewers(jr.data.viewers.current);
            }
          } catch {
            // Non-fatal: still show the stream even if presence fails.
          }
          startHeartbeat(watchSession.id);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load livestream right now.');
          setLoading(false);
        }
      } finally {
        if (!cancelled) pollTimer = setTimeout(load, 15000);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (beatTimer) clearInterval(beatTimer);
      if (joinedSessionId && viewerId) {
        artistLiveApi.leave(joinedSessionId, viewerId).catch(() => undefined);
      }
    };
  }, [artistId]);

  const resolvedAmountDollars =
    presetAmount === 'custom' ? Number(customAmount) || 0 : presetAmount;

  const handleDonate = async () => {
    if (!session?.id) return;
    const cents = Math.round(resolvedAmountDollars * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setDonationError('Minimum donation is $1.00.');
      return;
    }
    if (cents > 25000) {
      setDonationError('Maximum donation is $250.00.');
      return;
    }
    setDonationError(null);
    setDonating(true);
    try {
      const res = await artistLiveApi.createDonationCheckout(session.id, {
        amountCents: cents,
        message: donationMessage.trim() || undefined,
      });
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      setDonationError('Could not start checkout. Please try again.');
    } catch (err: unknown) {
      setDonationError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Donations are unavailable right now.',
      );
    } finally {
      setDonating(false);
    }
  };

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
        <h1 className="text-xl md:text-2xl font-semibold">
          {isDj ? 'Live DJ set' : 'Watch artist live'}
        </h1>
        <Link href={isDj ? '/dj' : `/artist/${artistId}`}>
          <Button variant="outline" size="sm">
            {isDj ? 'Back to Live DJ' : 'Back to artist'}
          </Button>
        </Link>
      </div>

      {donationNotice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {donationNotice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {session?.title || (isDj ? 'Live DJ set' : 'Live session')}
          </CardTitle>
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
                {viewers} watching now
              </p>

              {session?.id && (
                <div className="mt-4 rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Support this stream</p>
                    <p className="text-xs text-muted-foreground">
                      Send a tip to the {isDj ? 'DJ' : 'artist'}. Pick an amount
                      or enter your own.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {DONATION_PRESETS.map((amt) => (
                      <Button
                        key={amt}
                        type="button"
                        size="sm"
                        variant={presetAmount === amt ? 'default' : 'outline'}
                        onClick={() => {
                          setPresetAmount(amt);
                          setDonationError(null);
                        }}
                      >
                        ${amt}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant={presetAmount === 'custom' ? 'default' : 'outline'}
                      onClick={() => {
                        setPresetAmount('custom');
                        setDonationError(null);
                      }}
                    >
                      Custom
                    </Button>
                  </div>

                  {presetAmount === 'custom' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={1}
                        max={250}
                        step={1}
                        placeholder="Amount (USD)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="max-w-[160px]"
                      />
                    </div>
                  )}

                  <Input
                    type="text"
                    maxLength={140}
                    placeholder="Add a message (optional)"
                    value={donationMessage}
                    onChange={(e) => setDonationMessage(e.target.value)}
                  />

                  {donationError && (
                    <p className="text-xs text-destructive">{donationError}</p>
                  )}

                  <Button
                    className="w-full sm:w-auto"
                    disabled={donating}
                    onClick={handleDonate}
                  >
                    {donating
                      ? 'Redirecting…'
                      : `Donate $${resolvedAmountDollars > 0 ? resolvedAmountDollars : 0}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
