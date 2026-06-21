'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { creditsApi, analyticsApi, type DiscoverSwipeAnalytics } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

interface DailyPlayCount {
  date: string;
  plays: number;
  listens?: number;
  ears?: number;
}

interface TopSong {
  songId: string;
  title: string;
  artworkUrl: string | null;
  totalPlays: number;
  totalListens?: number;
  paidPlays: number;
  freePlays: number;
  creditsUsed: number;
  creditsRemaining: number;
  likeCount: number;
}

interface ArtistAnalytics {
  totalPlays: number;
  totalListenCount?: number;
  earsReached?: number;
  listensThisWeek?: number;
  listensThisMonth?: number;
  earsReachedThisWeek?: number;
  earsReachedThisMonth?: number;
  playsThisWeek?: number;
  playsThisMonth?: number;
  totalPaidPlays: number;
  totalFreePlays: number;
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
  const [discoverSwipes, setDiscoverSwipes] = useState<DiscoverSwipeAnalytics | null>(null);

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
      const [creditsRes, analyticsRes, roiRes, regionsRes, discoverRes] =
        await Promise.allSettled([
          creditsApi.getBalance(),
          analyticsApi.getMyAnalytics(30),
          analyticsApi.getMyRoi(30),
          analyticsApi.getMyPlaysByRegion(30),
          analyticsApi.getMyDiscoverSwipes(30),
        ]);

      if (creditsRes.status === 'fulfilled') {
        setCredits(creditsRes.value.data);
      }
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data as ArtistAnalytics);
      }
      if (roiRes.status === 'fulfilled') {
        setRoi(roiRes.value.data as RoiStats);
      }
      if (regionsRes.status === 'fulfilled') {
        setRegions((regionsRes.value.data as RegionCount[]) ?? []);
      }
      if (discoverRes.status === 'fulfilled') {
        setDiscoverSwipes(discoverRes.value.data as DiscoverSwipeAnalytics);
      } else {
        console.error('Failed to load discover swipe analytics:', discoverRes.reason);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const last7Days = analytics?.dailyPlays?.slice(-7) ?? [];
  const earsByDayForChart = last7Days.map((d) => {
    const day = new Date(`${d.date}T12:00:00`).getDay();
    return {
      day: DAY_NAMES[day],
      ears: d.ears ?? 0,
      listens: d.listens ?? 0,
    };
  });
  const totalEars = analytics?.earsReached ?? 0;
  const totalListens = analytics?.totalListenCount ?? 0;
  const earsThisWeek = analytics?.earsReachedThisWeek ?? 0;
  const earsThisMonth = analytics?.earsReachedThisMonth ?? 0;
  const listensThisWeek =
    analytics?.listensThisWeek ?? analytics?.playsThisWeek ?? 0;
  const listensThisMonth =
    analytics?.listensThisMonth ?? analytics?.playsThisMonth ?? 0;
  const maxEars = Math.max(1, ...earsByDayForChart.map((d) => d.ears));
  const maxListens = Math.max(1, ...earsByDayForChart.map((d) => d.listens));

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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track ears reached, engagement, and audience growth.</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Ears Reached</div>
            <div className="text-3xl font-bold text-foreground mt-1">{totalEars.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Unique listeners, all time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Listens</div>
            <div className="text-3xl font-bold text-foreground mt-1">{totalListens.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">People who heard your songs (once per song)</div>
            {totalListens === totalEars && (analytics?.totalSongs ?? 0) <= 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                With one song, each listener counts once in both metrics.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Ears This Week</div>
            <div className="text-3xl font-bold text-foreground mt-1">{earsThisWeek.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Unique listeners, last 7 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Listens This Week</div>
            <div className="text-3xl font-bold text-foreground mt-1">{listensThisWeek.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Song listens, last 7 days</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Ears This Month</div>
            <div className="text-3xl font-bold text-foreground mt-1">{earsThisMonth.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Unique listeners, last 30 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Listens This Month</div>
            <div className="text-3xl font-bold text-foreground mt-1">{listensThisMonth.toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Song listens, last 30 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Paid Plays</div>
            <div className="text-3xl font-bold text-foreground mt-1">{(analytics?.totalPaidPlays ?? 0).toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Credit-backed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Free Plays</div>
            <div className="text-3xl font-bold text-foreground mt-1">{(analytics?.totalFreePlays ?? 0).toLocaleString()}</div>
            <div className="text-sm text-primary mt-2">Trial/opt-in/fallback</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Right Swipes</div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {(discoverSwipes?.rightSwipes ?? 0).toLocaleString()}
            </div>
            <div className="text-sm text-primary mt-2">Last {discoverSwipes?.days ?? 30} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Left Swipes</div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {(discoverSwipes?.leftSwipes ?? 0).toLocaleString()}
            </div>
            <div className="text-sm text-primary mt-2">Last {discoverSwipes?.days ?? 30} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground font-medium">Avg Time to Swipe</div>
            <div className="text-3xl font-bold text-foreground mt-1">
              {discoverSwipes?.avgDecisionMs == null
                ? '—'
                : `${(discoverSwipes.avgDecisionMs / 1000).toFixed(1)}s`}
            </div>
            <div className="text-sm text-primary mt-2">
              {discoverSwipes?.totalSwipes ?? 0} total decisions
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Discover Swipe Breakdown</h2>
          {discoverSwipes?.bySong?.length ? (
            <div className="space-y-3">
              {discoverSwipes.bySong.map((song) => (
                <div key={song.songId} className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg decision:{' '}
                      {song.avgDecisionMs == null ? '—' : `${(song.avgDecisionMs / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground shrink-0">
                    <span className="mr-3">➡️ {song.rightSwipes}</span>
                    <span>⬅️ {song.leftSwipes}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No discover swipe data yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Ears Reached This Week</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Unique listeners per day (each account once)
            </p>
            {earsByDayForChart.length > 0 ? (
              <div className="flex items-end justify-between gap-3 h-52 artist-chart-plays">
                {earsByDayForChart.map((day, i) => {
                  const barHeight =
                    day.ears > 0
                      ? Math.max(12, Math.round((day.ears / maxEars) * 100))
                      : 0;
                  return (
                    <div
                      key={`ears-${day.day}-${i}`}
                      className="flex-1 flex flex-col items-center min-w-0"
                    >
                      <div className="w-full h-40 flex items-end justify-center">
                        <div
                          className="w-full max-w-10 rounded-t-lg bg-primary transition-all hover:bg-primary/80"
                          style={{ height: `${barHeight}%` }}
                          title={`${day.ears.toLocaleString()} ears`}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">{day.day}</div>
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {day.ears.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No ears reached in the last 7 days.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Listens This Week</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Unique song listens per day (once per song per person)
            </p>
            {earsByDayForChart.length > 0 ? (
              <div className="flex items-end justify-between gap-3 h-52 artist-chart-plays">
                {earsByDayForChart.map((day, i) => {
                  const barHeight =
                    day.listens > 0
                      ? Math.max(12, Math.round((day.listens / maxListens) * 100))
                      : 0;
                  return (
                    <div
                      key={`listens-${day.day}-${i}`}
                      className="flex-1 flex flex-col items-center min-w-0"
                    >
                      <div className="w-full h-40 flex items-end justify-center">
                        <div
                          className="w-full max-w-10 rounded-t-lg bg-pink-500 transition-all hover:bg-pink-500/80"
                          style={{ height: `${barHeight}%` }}
                          title={`${day.listens.toLocaleString()} listens`}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">{day.day}</div>
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {day.listens.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No listens in the last 7 days.</p>
            )}
          </CardContent>
        </Card>
      </div>

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
          <h2 className="text-xl font-semibold text-foreground mb-6">Top Performing Songs</h2>
          <div className="divide-y divide-border">
            {analytics?.topSongs && analytics.topSongs.length > 0 ? (
              analytics.topSongs.map((song, index) => (
                <div key={song.songId} className="py-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold shrink-0">{index + 1}</div>
                  {song.artworkUrl && <img src={song.artworkUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <Link href={`/artist/songs/${song.songId}`} className="font-medium text-foreground hover:underline block truncate">{song.title}</Link>
                    <p className="text-sm text-muted-foreground">
                      {(song.totalListens ?? 0).toLocaleString()} listens · {song.totalPlays.toLocaleString()} spins · {song.paidPlays.toLocaleString()} paid · {song.freePlays.toLocaleString()} free · {song.likeCount} ripples
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-muted-foreground">{song.creditsUsed.toLocaleString()} credits used</p>
                    <p className="text-xs text-muted-foreground">{song.creditsRemaining} remaining</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4">No ears reached yet. Upload and get your music on the radio to see stats here.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">More analytics coming soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working on detailed analytics including Prospector demographics, peak listening times, and engagement metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
