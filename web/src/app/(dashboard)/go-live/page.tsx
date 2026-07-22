'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { artistLiveApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraBroadcaster } from '@/components/stream/CameraBroadcaster';
import { LiveChat } from '@/components/stream/LiveChat';

type Ingest = {
  rtmpUrl: string | null;
  streamKey: string | null;
  webRtcUrl?: string | null;
};

export default function GoLiveStudioPage() {
  const { profile } = useAuth();
  const artistId = profile?.id ?? null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [hostKind, setHostKind] = useState<'dj' | 'musician' | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ingest, setIngest] = useState<Ingest | null>(null);
  // Where the broadcast comes from. Only one source may publish to the
  // Cloudflare input at a time: 'device' runs the in-app WebRTC broadcaster
  // (uses this computer's camera/mic); 'obs' stops it so an external encoder
  // (OBS) can stream via RTMP without conflicting.
  const [source, setSource] = useState<'device' | 'obs'>('device');
  const [error, setError] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // `?as=dj` / `?as=musician` (set by the go-live entry points) tags the
    // session so it appears on the matching Live tab regardless of account role.
    if (typeof window !== 'undefined') {
      const as = new URLSearchParams(window.location.search).get('as');
      if (as === 'dj') setHostKind('dj');
      else if (as === 'musician') setHostKind('musician');
    }
  }, []);

  useEffect(() => {
    if (!artistId) {
      setChecking(false);
      return;
    }
    artistLiveApi
      .getStatus(artistId)
      .then((res) => {
        const data = res.data as {
          live?: boolean;
          session?: { id?: string; title?: string | null } | null;
        };
        if (data?.live && data.session) {
          setIsLive(true);
          if (data.session.id) setSessionId(data.session.id);
          if (data.session.title) setTitle(data.session.title);
        }
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [artistId]);

  const handleStart = async () => {
    if (!artistId) return;
    setError(null);
    setStartLoading(true);
    try {
      const res = await artistLiveApi.start({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        hostType: hostKind ?? undefined,
      });
      const resData = res.data as {
        ingest?: Ingest;
        session?: { id?: string } | null;
      };
      setIngest(resData?.ingest ?? null);
      // If the backend didn't return a WebRTC URL, in-app broadcasting isn't
      // possible — default to the OBS/RTMP source.
      setSource(resData?.ingest?.webRtcUrl ? 'device' : 'obs');
      if (resData?.session?.id) setSessionId(resData.session.id);
      setIsLive(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
          (err instanceof Error ? err.message : 'Failed to start stream'),
      );
    } finally {
      setStartLoading(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setStopLoading(true);
    try {
      await artistLiveApi.stop();
      setIsLive(false);
      setIngest(null);
      setSessionId(null);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
          (err instanceof Error ? err.message : 'Failed to stop stream'),
      );
    } finally {
      setStopLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>{hostKind === 'dj' ? '🎧' : hostKind === 'musician' ? '🎤' : '🔴'}</span>{' '}
            {hostKind === 'dj'
              ? 'Go Live as DJ'
              : hostKind === 'musician'
                ? 'Go Live as Musician'
                : 'Go Live'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Broadcast straight from your camera and mic — no extra software
            needed.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={hostKind === 'musician' ? '/performances' : '/dj'}>
            Back
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {checking ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : isLive ? (
        <div className="space-y-4">
          <Alert className="border-green-600/50 bg-green-500/10">
            <AlertDescription className="text-green-800 dark:text-green-200">
              You&apos;re live. Stay on this page while broadcasting — leaving
              ends the camera feed.
            </AlertDescription>
          </Alert>

          {/* Broadcast source toggle. Only ONE source streams to Cloudflare at
              a time — switching to OBS unmounts the in-app broadcaster so this
              computer's camera/mic stop being used. */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Broadcast source
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={source === 'device' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSource('device')}
                disabled={!ingest?.webRtcUrl}
              >
                This device (camera &amp; mic)
              </Button>
              <Button
                type="button"
                variant={source === 'obs' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSource('obs')}
              >
                OBS / encoder (RTMP)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {source === 'device'
                ? 'Streaming from this browser — your computer camera/mic are in use.'
                : 'Streaming from OBS or another encoder. This browser is NOT capturing your camera/mic.'}
            </p>
          </div>

          {source === 'device' ? (
            ingest?.webRtcUrl ? (
              // DJ sets default to audio-only (camera off) unless the DJ turns
              // the camera on. Musician performances start with the camera on.
              <div className="relative">
                <CameraBroadcaster
                  whipUrl={ingest.webRtcUrl}
                  startCameraOff={hostKind === 'dj'}
                  onPublishing={() => {
                    void artistLiveApi
                      .markPublishing(sessionId ?? undefined)
                      .catch(() => undefined);
                  }}
                  onError={(message) => {
                    setError(message);
                    // Tear down the ghost session so watchers aren't stuck on
                    // a black player and the host can start again.
                    void artistLiveApi
                      .stop()
                      .then(() => {
                        setIsLive(false);
                        setSessionId(null);
                        setIngest(null);
                      })
                      .catch(() => undefined);
                  }}
                />
                {sessionId && artistId && (
                  <div className="absolute right-2 top-2 z-10 flex h-[55%] max-h-[440px] w-[72%] max-w-[20rem] sm:w-80">
                    <LiveChat
                      overlay
                      sessionId={sessionId}
                      artistId={artistId}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  In-app broadcasting isn&apos;t available for this session.
                  Switch to OBS / encoder (RTMP) above, or end the stream and
                  start again.
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="space-y-3 py-4">
                <p className="text-sm font-medium">OBS / encoder setup</p>
                {ingest?.rtmpUrl || ingest?.streamKey ? (
                  <>
                    {ingest.rtmpUrl && (
                      <div className="space-y-1">
                        <Label className="text-xs">Server (RTMP URL)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={ingest.rtmpUrl}
                            className="font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigator.clipboard?.writeText(
                                ingest.rtmpUrl ?? '',
                              )
                            }
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    {ingest.streamKey && (
                      <div className="space-y-1">
                        <Label className="text-xs">Stream key</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            type="password"
                            value={ingest.streamKey}
                            className="font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigator.clipboard?.writeText(
                                ingest.streamKey ?? '',
                              )
                            }
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      In OBS: Settings → Stream → Service &quot;Custom&quot;,
                      paste the Server and Stream Key, set keyframe interval to
                      2s, then Start Streaming.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    RTMP details aren&apos;t available for this session.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* When there's no in-app camera preview (OBS/encoder), show the chat
              as a normal panel instead of an overlay. */}
          {!(source === 'device' && ingest?.webRtcUrl) &&
            sessionId &&
            artistId && (
              <LiveChat sessionId={sessionId} artistId={artistId} />
            )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleStop}
              disabled={stopLoading}
            >
              {stopLoading ? 'Ending…' : 'End stream'}
            </Button>
            {artistId && (
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/watch/${artistId}`} target="_blank">
                  Open watch page
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="title">Stream title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday night set"
                maxLength={140}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this stream about?"
                rows={3}
                maxLength={1000}
                className="resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Music, Talk"
                maxLength={64}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleStart}
              disabled={startLoading || !artistId}
            >
              {startLoading ? 'Starting…' : '🔴 Start stream'}
            </Button>
            {!artistId && (
              <p className="text-xs text-muted-foreground">
                Sign in to start a broadcast.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
