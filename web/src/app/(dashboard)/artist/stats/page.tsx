'use client';

import { useState, useEffect } from 'react';
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

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState({ balance: 0, totalPurchased: 0, totalUsed: 0 });
  const [analytics, setAnalytics] = useState<ArtistAnalytics | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [creditsRes, analyticsRes] = await Promise.all([
        creditsApi.getBalance(),
        analyticsApi.getMyAnalytics(30),
      ]);
      setCredits(creditsRes.data);
      setAnalytics(analyticsRes.data as ArtistAnalytics);
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Discoveries This Week</h2>
          <div className="flex items-end justify-between h-48 gap-2">
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
          <h2 className="text-xl font-semibold text-foreground mb-6">Top Performing Songs</h2>
          <div className="divide-y divide-border">
            {analytics?.topSongs && analytics.topSongs.length > 0 ? (
              analytics.topSongs.map((song, index) => (
                <div key={song.songId} className="py-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold shrink-0">{index + 1}</div>
                  {song.artworkUrl && <img src={song.artworkUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <Link href={`/artist/songs/${song.songId}`} className="font-medium text-foreground hover:underline block truncate">{song.title}</Link>
                    <p className="text-sm text-muted-foreground">{song.totalPlays.toLocaleString()} discoveries · {song.likeCount} likes</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-muted-foreground">{song.creditsUsed.toLocaleString()} credits used</p>
                    <p className="text-xs text-muted-foreground">{song.creditsRemaining} remaining</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4">No songs with discoveries yet. Upload and get your music on the radio to see stats here.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">More Analytics Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working on detailed analytics including listener demographics, peak listening times, and engagement metrics.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
