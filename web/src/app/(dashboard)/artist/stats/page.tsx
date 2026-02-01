'use client';

import { useState, useEffect } from 'react';
import { creditsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

// Placeholder data - in production this would come from an analytics API
const mockStats = {
  totalPlays: 1234,
  thisWeek: 256,
  thisMonth: 890,
  topSongs: [
    { id: '1', title: 'Summer Nights', plays: 456, credits: 100 },
    { id: '2', title: 'Midnight Dreams', plays: 312, credits: 75 },
    { id: '3', title: 'City Lights', plays: 198, credits: 50 },
  ],
  playsByDay: [
    { day: 'Mon', plays: 45 },
    { day: 'Tue', plays: 62 },
    { day: 'Wed', plays: 38 },
    { day: 'Thu', plays: 71 },
    { day: 'Fri', plays: 85 },
    { day: 'Sat', plays: 92 },
    { day: 'Sun', plays: 78 },
  ],
};

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState({ balance: 0, totalPurchased: 0, totalUsed: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const creditsRes = await creditsApi.getBalance();
      setCredits(creditsRes.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const maxPlays = Math.max(...mockStats.playsByDay.map(d => d.plays));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground font-medium">Total Plays</div>
          <div className="text-3xl font-bold text-foreground mt-1">{mockStats.totalPlays.toLocaleString()}</div>
          <div className="text-sm text-primary mt-2">All time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground font-medium">This Week</div>
          <div className="text-3xl font-bold text-foreground mt-1">{mockStats.thisWeek.toLocaleString()}</div>
          <div className="text-sm text-primary mt-2">+12% from last week</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground font-medium">This Month</div>
          <div className="text-3xl font-bold text-foreground mt-1">{mockStats.thisMonth.toLocaleString()}</div>
          <div className="text-sm text-primary mt-2">+8% from last month</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground font-medium">Credits Used</div>
          <div className="text-3xl font-bold text-foreground mt-1">{credits.totalUsed.toLocaleString()}</div>
          <div className="text-sm text-primary mt-2">{credits.balance} remaining</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
        <h2 className="text-xl font-semibold text-foreground mb-6">Plays This Week</h2>
        
        <div className="flex items-end justify-between h-48 gap-2">
          {mockStats.playsByDay.map((day) => (
            <div key={day.day} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-primary rounded-t-lg transition-all hover:bg-primary/80" style={{ height: `${(day.plays / maxPlays) * 100}%` }} />
              <div className="text-sm text-muted-foreground mt-2">{day.day}</div>
              <div className="text-xs text-muted-foreground">{day.plays}</div>
            </div>
          ))}
        </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Top Performing Songs</h2>
          <div className="divide-y divide-border">
            {mockStats.topSongs.map((song, index) => (
              <div key={song.id} className="py-4 flex items-center">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mr-4">{index + 1}</div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{song.title}</p>
                  <p className="text-sm text-muted-foreground">{song.plays} plays</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{song.credits} credits used</p>
                </div>
              </div>
            ))}
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
