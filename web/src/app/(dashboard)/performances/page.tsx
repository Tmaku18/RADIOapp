'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { artistLiveApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasMusicianCapability } from '@/lib/roles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type LiveSession = {
  sessionId: string;
  artistId: string;
  displayName: string;
  avatarUrl: string | null;
  title: string | null;
  currentViewers: number;
  peakViewers: number;
  startedAt: string;
  status: string;
  hostRole?: string;
};

export default function LivePerformancesPage() {
  const { profile } = useAuth();
  const canHost = hasMusicianCapability(profile?.role);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await artistLiveApi.listSessions();
      const data = res.data as { sessions?: LiveSession[] };
      const performances = Array.isArray(data?.sessions)
        ? data.sessions.filter((s) => s.hostRole === 'musician')
        : [];
      setSessions(performances);
    } catch {
      // Livestreaming may be disabled or unreachable — treat as offline.
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await load();
    };
    run();
    const interval = setInterval(run, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  const sorted = [...sessions].sort(
    (a, b) => b.currentViewers - a.currentViewers,
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span>🎤</span> Live Performances
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Watch a musician performing live right now — audio and video, in real time.
          </p>
        </div>
        {canHost && (
          <Button
            asChild
            className="bg-primary text-primary-foreground hover:opacity-90 shrink-0"
          >
            <Link href="/go-live?as=musician">🔴 Go live as musician</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <div className="text-5xl">🎸</div>
            <p className="text-lg font-medium text-foreground">No live performance right now</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The stage is empty. When a musician goes live, their performance will appear here.
              {canHost ? ' Ready to play? Hit “Go live as musician”.' : ''}
            </p>
            {canHost && (
              <Button variant="outline" asChild>
                <Link href="/go-live?as=musician">Go live as musician</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((s) => (
            <Link key={s.sessionId} href={`/watch/${s.artistId}`}>
              <Card className="overflow-hidden transition-colors hover:bg-muted/50">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted flex items-center justify-center relative">
                    <span className="text-4xl">🎤</span>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-medium">
                      LIVE
                    </span>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
                      {s.currentViewers} watching
                    </span>
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                      {s.avatarUrl ? (
                        <Image src={s.avatarUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">🎤</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.displayName}</p>
                      <p className="text-sm text-muted-foreground truncate">{s.title || 'Live performance'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
