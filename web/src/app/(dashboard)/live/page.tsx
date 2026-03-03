'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { artistLiveApi } from '@/lib/api';
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
};

type SortOption = 'recommended' | 'viewers_high' | 'viewers_low' | 'recent';

export default function LivePage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('viewers_high');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await artistLiveApi.listSessions();
        const data = res.data as { sessions?: LiveSession[] };
        if (!cancelled && Array.isArray(data?.sessions)) {
          setSessions(data.sessions);
        }
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const sorted = [...sessions].sort((a, b) => {
    if (sort === 'viewers_high') return b.currentViewers - a.currentViewers;
    if (sort === 'viewers_low') return a.currentViewers - b.currentViewers;
    if (sort === 'recent') return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    return b.currentViewers - a.currentViewers;
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Live</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="recommended">Recommended</option>
            <option value="viewers_high">Viewers (High to Low)</option>
            <option value="viewers_low">Viewers (Low to High)</option>
            <option value="recent">Recently Started</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No one is live right now.</p>
            <p className="text-sm text-muted-foreground mt-2">When artists go live, they’ll show up here and on the Listen page.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((s) => (
            <Link key={s.sessionId} href={`/watch/${s.artistId}`}>
              <Card className="overflow-hidden transition-colors hover:bg-muted/50">
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted flex items-center justify-center relative">
                    <span className="text-4xl">🔴</span>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-medium">
                      LIVE
                    </span>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
                      {s.currentViewers} viewers
                    </span>
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                      {s.avatarUrl ? (
                        <Image src={s.avatarUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">?</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.displayName}</p>
                      <p className="text-sm text-muted-foreground truncate">{s.title || 'Live stream'}</p>
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
