'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { creditsApi, analyticsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

interface DailyPlayCount {
  date: string;
  plays: number;
}

interface TopSong {
  songId: string;
  title: string;
  artworkUrl: string | null;
  totalPlays: number;
  creditsUsed: number;
  creditsRemaining: number;
  likeCount: number;
}

interface ArtistAnalytics {
  totalPlays: number;
  totalSongs: number;
  totalLikes: number;
  totalCreditsUsed: number;
  creditsRemaining: number;
  dailyPlays: DailyPlayCount[];
  topSongs: TopSong[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RoiStats {
  days: number;
  newFollowers: number;
  creditsSpentInWindow: number;
  roi: number | null;
}

interface RegionCount {
  region: string;
  count: number;
}

interface PlayDetail {
  id: string;
  songId: string;
  songTitle: string;
  playedAt: string;
  listenersAtStart: number;
  listenersAtEnd: number | null;
  netListenerChange: number | null;
  likesDuring: number;
  commentsDuring: number;
  disconnectsDuring: number;
  profileClicksDuring: number;
}

export default function StatsPage() {
  const searchParams = useSearchParams();
  const playIdFromQuery = searchParams.get('playId');
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState({ balance: 0, totalPurchased: 0, totalUsed: 0 });
  const [analytics, setAnalytics] = useState<ArtistAnalytics | null>(null);
  const [playDetail, setPlayDetail] = useState<PlayDetail | null>(null);
  const [roi, setRoi] = useState<RoiStats | null>(null);
  const [regions, setRegions] = useState<RegionCount[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (playIdFromQuery) {
      analyticsApi.getPlayById(playIdFromQuery)
        .then((res) => setPlayDetail(res.data as PlayDetail))
        .catch(() => setPlayDetail(null));
    } else {
      setPlayDetail(null);
    }
  }, [playIdFromQuery]);

  const loadStats = async () => {
    try {
      const [creditsRes, analyticsRes, roiRes, regionsRes] = await Promise.all([
        creditsApi.getBalance(),
        analyticsApi.getMyAnalytics(30),
        analyticsApi.getMyRoi(30),
        analyticsApi.getMyPlaysByRegion(30),
      ]);
      setCredits(creditsRes.data);
      setAnalytics(analyticsRes.data as ArtistAnalytics);
      setRoi(roiRes.data as RoiStats);
      setRegions((regionsRes.data as RegionCount[]) ?? []);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const last7Days = analytics?.dailyPlays?.slice(-7) ?? [];
  const thisWeekPlays = last7Days.reduce((sum, d) => sum + d.plays, 0);
  const thisMonthPlays = analytics?.dailyPlays?.reduce((sum, d) => sum + d.plays, 0) ?? 0;
  const playsByDayForChart = last7Days.map((d) => {
    const day = new Date(d.date).getDay();
    return { day: DAY_NAMES[day], plays: d.plays };
  });
  const maxPlays = Math.max(1, ...playsByDayForChart.map((d) => d.plays));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatPlayTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">The Wake</h1>
        <p className="text-muted-foreground mt-1">The path left behind by a thousand Ripples.</p>
      </div>
      {playDetail && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <span>🎵</span> This play
            </h3>
            <p className="text-muted-foreground font-medium">{playDetail.songTitle}</p>
            <p className="text-sm text-muted-foreground mt-1">Played at {formatPlayTime(playDetail.playedAt)}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Prospectors: {playDetail.listenersAtStart}</span>
              {playDetail.listenersAtEnd != null && <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">End: {playDetail.listenersAtEnd}</span>}
              {playDetail.netListenerChange != null && <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Net: {playDetail.netListenerChange >= 0 ? '+' : ''}{playDetail.netListenerChange}</span>}
              <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Ripples: {playDetail.likesDuring}</span>
              <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Comments: {playDetail.commentsDuring}</span>
              <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Disconnects: {playDetail.disconnectsDuring}</span>
              <span className="inline-flex items-center rounded-md bg-muted px-3 py-1 text-sm">Profile clicks: {playDetail.profileClicksDuring}</span>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground font-medium">Guaranteed Signals Remaining</div>
          <div className="text-4xl font-bold text-primary mt-1">{credits.balance.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-2">Plays we&apos;ve promised your tracks</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Discoveries</div>
            <div className="text-3xl font-bold text-foreground mt-1">{(analytics?.totalPlays ?? 0).toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">All time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">This Week</div>
            <div className="text-3xl font-bold text-foreground mt-1">{thisWeekPlays.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Last 7 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">This Month</div>
            <div className="text-3xl font-bold text-foreground mt-1">{thisMonthPlays.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Last 30 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Credits Used</div>
            <div className="text-3xl font-bold text-foreground mt-1">{(analytics?.totalCreditsUsed ?? credits.totalUsed).toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">{credits.balance} remaining</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">ROI</div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {roi?.roi == null ? '—' : `${roi.roi.toFixed(1)}%`}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {roi?.newFollowers ?? 0} new followers / {roi?.creditsSpentInWindow ?? 0} credits (last {roi?.days ?? 30}d)
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Discoveries This Week</h2>
          <div className="flex items-end justify-between h-48 gap-2 artist-chart-plays">
            {playsByDayForChart.length > 0 ? (
              playsByDayForChart.map((day, i) => (
                <div key={`${day.day}-${i}`} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-primary rounded-t-lg transition-all hover:bg-primary/80" style={{ height: `${(day.plays / maxPlays) * 100}%` }} />
                  <div className="text-sm text-muted-foreground mt-2">{day.day}</div>
                  <div className="text-xs text-muted-foreground">{day.plays}</div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm col-span-full">No discoveries in the last 7 days.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Prospector Heatmap (by region)</h2>
          {regions.length > 0 ? (
            <div className="space-y-2">
              {regions.slice(0, 10).map((r) => (
                <div key={r.region} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-muted-foreground truncate">{r.region}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/80"
                      style={{
                        width: `${Math.min(100, (r.count / Math.max(1, regions[0]?.count ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-sm text-muted-foreground tabular-nums">{r.count}</div>
                </div>
              ))}
              {regions.length > 10 && (
                <div className="text-xs text-muted-foreground pt-2">Showing top 10 regions (last 30d).</div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No regional engagement data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Top Performing Ores</h2>
          <div className="divide-y divide-border">
            {analytics?.topSongs && analytics.topSongs.length > 0 ? (
              analytics.topSongs.map((song, index) => (
                <div key={song.songId} className="py-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold shrink-0">{index + 1}</div>
                  {song.artworkUrl && <img src={song.artworkUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <Link href={`/artist/songs/${song.songId}`} className="font-medium text-foreground hover:underline block truncate">{song.title}</Link>
                    <p className="text-sm text-muted-foreground">{song.totalPlays.toLocaleString()} discoveries · {song.likeCount} ripples</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-muted-foreground">{song.creditsUsed.toLocaleString()} credits used</p>
                    <p className="text-xs text-muted-foreground">{song.creditsRemaining} remaining</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4">No ores with discoveries yet. Upload and get your music on the radio to see stats here.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">More of The Wake Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working on detailed analytics including Prospector demographics, peak listening times, and engagement metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
