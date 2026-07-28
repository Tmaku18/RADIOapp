'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import { artistLiveApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LiveChat } from '@/components/stream/LiveChat';
import { useAuth } from '@/contexts/AuthContext';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';

type WatchSession = {
  id: string;
  status: 'starting' | 'live' | 'ended' | 'failed' | 'scheduled';
  title?: string | null;
  playback_hls_url?: string | null;
  watch_url?: string | null;
  /** WHEP (WebRTC) playback URL — the only way to watch WHIP-published streams. */
  whep_url?: string | null;
  /** 'whip' (in-app camera) | 'rtmp' (OBS) | null when unknown. */
  ingest_mode?: string | null;
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

/** Unmute after playback starts — radio is soft-paused on this page. */
function unmuteLiveVideo(video: HTMLMediaElement) {
  video.muted = false;
  video.volume = 1;
  void video.play().catch(() => undefined);
}

/**
 * Cross-browser HLS player: uses hls.js where MSE is supported, native HLS
 * otherwise. Built to tolerate a *just-started* live stream where the HLS
 * manifest/segments aren't ready for the first several seconds — it keeps
 * retrying instead of getting stuck. Starts muted for autoplay, then unmutes
 * once the stream is playing (radio is soft-paused while watching).
 */
function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'playing' | 'error'>(
    'connecting',
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryPlay = () => {
      video.play()
        .then(() => {
          if (!destroyed) unmuteLiveVideo(video);
        })
        .catch(() => undefined);
    };
    const onPlaying = () => {
      setStatus('playing');
      if (!destroyed) unmuteLiveVideo(video);
    };

    // Safari / iOS play HLS natively; let the browser retry the live edge.
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        const onLoaded = () => {
          setStatus('playing');
          tryPlay();
        };
        const onError = () => {
          if (destroyed) return;
          // Live edge may not be ready yet — reload shortly.
          retryTimer = setTimeout(() => {
            if (!destroyed) video.load();
          }, 4000);
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('error', onError);
        return () => {
          destroyed = true;
          if (retryTimer) clearTimeout(retryTimer);
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('playing', onPlaying);
          video.removeEventListener('error', onError);
        };
      }
      setStatus('error');
      return;
    }

    let hls: Hls | null = null;

    const create = () => {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveDurationInfinity: true,
        manifestLoadingMaxRetry: 8,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 8,
        fragLoadingMaxRetry: 8,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        tryPlay();
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (!destroyed) setStatus('playing');
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus('connecting');
          // Manifest/segment not ready yet on a fresh stream → keep retrying,
          // and fully recreate if the manifest itself can't be loaded.
          const manifestMissing =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
          if (manifestMissing) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (destroyed) return;
              try {
                hls?.destroy();
              } catch {
                // ignore
              }
              create();
            }, 4000);
          } else {
            try {
              hls?.startLoad();
            } catch {
              // ignore — recreate path below handles persistent failures
            }
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setStatus('connecting');
          try {
            hls?.recoverMediaError();
          } catch {
            try {
              hls?.destroy();
            } catch {
              // ignore
            }
            if (!destroyed) create();
          }
        } else {
          try {
            hls?.destroy();
          } catch {
            // ignore
          }
          if (!destroyed) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (!destroyed) create();
            }, 4000);
          }
        }
      });
    };

    video.addEventListener('playing', onPlaying);
    create();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      video.removeEventListener('playing', onPlaying);
      try {
        hls?.destroy();
      } catch {
        // ignore
      }
    };
  }, [src]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full rounded-lg border border-border bg-black"
        controls
        autoPlay
        muted
        playsInline
      />
      {status !== 'playing' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
            {status === 'error'
              ? 'Playback not supported in this browser'
              : 'Connecting to live stream…'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * WHEP (WebRTC) live player. Streams published from the in-app camera use
 * WHIP ingest, for which Cloudflare produces NO HLS/DASH — the iframe player
 * and hls.js sit on a black screen forever. WHEP is the only playback path
 * for those streams (and gives sub-second latency as a bonus).
 */
function WhepPlayer({
  src,
  onPermanentFailure,
}: {
  src: string;
  onPermanentFailure?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'playing'>('connecting');

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;
    let destroyed = false;
    let pc: RTCPeerConnection | null = null;
    let resourceUrl: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    const MAX_FAILURES = 8;

    const teardown = () => {
      if (resourceUrl) {
        void fetch(resourceUrl, { method: 'DELETE' }).catch(() => undefined);
        resourceUrl = null;
      }
      try {
        pc?.close();
      } catch {
        // ignore
      }
      pc = null;
    };

    const scheduleRetry = () => {
      if (destroyed) return;
      failures += 1;
      teardown();
      if (failures > MAX_FAILURES) {
        onPermanentFailure?.();
        return;
      }
      setStatus('connecting');
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!destroyed) void connect();
      }, 2500);
    };

    const connect = async () => {
      teardown();
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      });
      pc = peer;
      peer.addTransceiver('video', { direction: 'recvonly' });
      peer.addTransceiver('audio', { direction: 'recvonly' });
      peer.ontrack = (event) => {
        if (destroyed) return;
        setStatus('playing');
        failures = 0;
        // Route each track to its own element. Audio-only phases (DJ with the
        // camera off) negotiate a video track that never delivers frames; if
        // that dead track shares the element's stream, Chrome waits for the
        // first video frame and never starts the AUDIO either. A dedicated
        // audio element plays voice immediately; the video element lights up
        // whenever frames actually arrive.
        if (event.track.kind === 'audio') {
          audio.srcObject = new MediaStream([event.track]);
          // Start muted for autoplay, then unmute (radio is soft-paused here).
          audio.muted = true;
          audio
            .play()
            .then(() => {
              if (!destroyed) unmuteLiveVideo(audio);
            })
            .catch(() => undefined);
          return;
        }
        video.srcObject = new MediaStream([event.track]);
        // Keep the video element permanently muted — sound comes from the
        // dedicated audio element.
        video.muted = true;
        void video.play().catch(() => undefined);
      };
      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === 'failed' ||
          peer.connectionState === 'disconnected'
        ) {
          scheduleRetry();
        }
      };

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === 'complete') return resolve();
          const timeout = setTimeout(() => resolve(), 2500);
          const check = () => {
            if (peer.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              peer.removeEventListener('icegatheringstatechange', check);
              resolve();
            }
          };
          peer.addEventListener('icegatheringstatechange', check);
        });

        const res = await fetch(src, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: peer.localDescription?.sdp ?? offer.sdp ?? '',
        });
        if (!res.ok) throw new Error(`WHEP negotiation failed (${res.status})`);
        const location = res.headers.get('Location');
        if (location) {
          try {
            resourceUrl = new URL(location, src).toString();
          } catch {
            resourceUrl = location;
          }
        }
        const answer = await res.text();
        if (destroyed) return;
        await peer.setRemoteDescription({ type: 'answer', sdp: answer });
      } catch {
        scheduleRetry();
      }
    };

    void connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      teardown();
      video.srcObject = null;
      audio.srcObject = null;
    };
  }, [src, onPermanentFailure]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-lg border border-border bg-black"
        controls
        autoPlay
        muted
        playsInline
      />
      {/* Live audio plays here so a frameless video track can't block it. */}
      <audio ref={audioRef} autoPlay className="hidden" />
      {status !== 'playing' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
            Connecting to live stream…
          </span>
        </div>
      )}
    </div>
  );
}

export default function WatchArtistLivePage() {
  const params = useParams<{ artistId: string }>();
  const artistId = useMemo(
    () => (typeof params?.artistId === 'string' ? params.artistId : ''),
    [params],
  );
  const { profile } = useAuth();
  const playback = usePlaybackOptional();
  const didSoftPauseRadioRef = useRef(false);
  const isAdmin = profile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WatchSession | null>(null);
  const [hostRole, setHostRole] = useState<string>('artist');
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(0);
  const [ending, setEnding] = useState(false);

  // Mute radio while watching so the livestream can be heard; restore on leave.
  useEffect(() => {
    const actions = playback?.actions;
    if (!actions || didSoftPauseRadioRef.current) return;
    actions.softPause();
    didSoftPauseRadioRef.current = true;
    return () => {
      if (!didSoftPauseRadioRef.current) return;
      didSoftPauseRadioRef.current = false;
      void actions.softResume();
    };
  }, [playback?.actions]);

  // Donation UI state
  const [presetAmount, setPresetAmount] = useState<number | 'custom'>(5);
  const [customAmount, setCustomAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [donating, setDonating] = useState(false);
  const [donationError, setDonationError] = useState<string | null>(null);
  const [donationNotice, setDonationNotice] = useState<string | null>(null);

  const isDj = hostRole === 'dj';

  // WHEP is required for in-app camera (WHIP) broadcasts; when the ingest
  // mode is unknown we try WHEP first and fall back to iframe/HLS if it
  // never connects (i.e. the stream is actually RTMP).
  const [whepFailedSessionId, setWhepFailedSessionId] = useState<string | null>(
    null,
  );
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = session?.id ?? null;
  const handleWhepFailure = useCallback(() => {
    setWhepFailedSessionId(sessionIdRef.current);
  }, []);
  const useWhepPlayer =
    !!session?.whep_url &&
    session.ingest_mode !== 'rtmp' &&
    whepFailedSessionId !== session.id;

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

  const handleAdminEnd = async () => {
    if (!session?.id) return;
    if (
      !window.confirm(
        'End this stream for everyone? The broadcaster will be cut off immediately.',
      )
    ) {
      return;
    }
    setEnding(true);
    try {
      await artistLiveApi.adminForceStop(session.id);
      setSession(null);
      setError('Stream ended by admin.');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not end the stream.',
      );
    } finally {
      setEnding(false);
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
        <div className="flex items-center gap-2">
          {isAdmin && session?.id && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleAdminEnd}
              disabled={ending}
            >
              {ending ? 'Ending…' : 'End stream (admin)'}
            </Button>
          )}
          <Link href={isDj ? '/dj' : `/artist/${artistId}`}>
            <Button variant="outline" size="sm">
              {isDj ? 'Back to Live DJ' : 'Back to artist'}
            </Button>
          </Link>
        </div>
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
              <div className="relative">
              {useWhepPlayer && session?.whep_url ? (
                // In-app camera broadcasts publish via WHIP, which Cloudflare
                // only serves back over WHEP (WebRTC) — the iframe and HLS
                // players would sit on a black screen forever.
                <div className="relative">
                  <WhepPlayer
                    src={session.whep_url}
                    onPermanentFailure={handleWhepFailure}
                  />
                  {session.status === 'starting' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                      <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs text-white">
                        Waiting for broadcaster to connect…
                      </span>
                    </div>
                  )}
                </div>
              ) : session?.watch_url ? (
                // OBS/RTMP broadcasts transcode to HLS, so Cloudflare's own
                // player works and handles the live startup window well.
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`${session.watch_url}${
                      session.watch_url.includes('?') ? '&' : '?'
                    }autoplay=true&muted=false`}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    title={isDj ? 'Live DJ set' : 'Artist livestream'}
                  />
                  {session.status === 'starting' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
                      <span className="rounded-full bg-black/80 px-3 py-1.5 text-xs text-white">
                        Waiting for broadcaster to connect…
                      </span>
                    </div>
                  )}
                </div>
              ) : session?.playback_hls_url ? (
                <HlsPlayer src={session.playback_hls_url} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Stream is initializing. Refresh in a few seconds.
                </p>
              )}
              {session?.id &&
                (session?.watch_url || session?.playback_hls_url) && (
                  <div className="absolute right-2 top-2 z-10 flex h-[55%] max-h-[440px] w-[72%] max-w-[20rem] sm:w-80">
                    <LiveChat
                      overlay
                      sessionId={session.id}
                      artistId={artistId}
                    />
                  </div>
                )}
              </div>
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
