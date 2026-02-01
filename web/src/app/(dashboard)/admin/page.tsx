'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalSongs: number;
  totalPlays: number;
  pendingSongs: number;
  approvedSongs: number;
  totalLikes: number;
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect non-admins
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    loadAnalytics();
  }, [profile, router]);

  const loadAnalytics = async () => {
    try {
      const response = await adminApi.getAnalytics();
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics');
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

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">👥</span>
            <div>
              <div className="text-sm text-muted-foreground">Total Users</div>
              <div className="text-2xl font-bold text-foreground">{analytics?.totalUsers?.toLocaleString() || 0}</div>
            </div>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🎤</span>
            <div>
              <div className="text-sm text-muted-foreground">Artists</div>
              <div className="text-2xl font-bold text-foreground">{analytics?.totalArtists?.toLocaleString() || 0}</div>
            </div>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🎵</span>
            <div>
              <div className="text-sm text-muted-foreground">Total Songs</div>
              <div className="text-2xl font-bold text-foreground">{analytics?.totalSongs?.toLocaleString() || 0}</div>
            </div>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center">
            <span className="text-3xl mr-3">▶️</span>
            <div>
              <div className="text-sm text-muted-foreground">Total Plays</div>
              <div className="text-2xl font-bold text-foreground">{analytics?.totalPlays?.toLocaleString() || 0}</div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <Link href="/admin/songs">
            <CardContent className="pt-6 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">⏳</span>
                {analytics?.pendingSongs && analytics.pendingSongs > 0 && (
                  <Badge variant="secondary">{analytics.pendingSongs} pending</Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold text-foreground">Song Moderation</h3>
              <p className="text-muted-foreground text-sm mt-1">Review and approve submitted tracks</p>
            </CardContent>
          </Link>
        </Card>

        <Card>
          <Link href="/admin/users">
            <CardContent className="pt-6 hover:bg-muted/50 transition-colors">
              <div className="mb-4"><span className="text-3xl">👥</span></div>
              <h3 className="text-lg font-semibold text-foreground">User Management</h3>
              <p className="text-muted-foreground text-sm mt-1">Manage users and their roles</p>
            </CardContent>
          </Link>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4"><span className="text-3xl">📊</span></div>
            <h3 className="text-lg font-semibold text-foreground">Analytics</h3>
            <p className="text-muted-foreground text-sm mt-1">Platform metrics and insights</p>
            <p className="text-primary text-sm mt-2">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Content Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-muted rounded-xl p-4">
              <div className="text-sm text-muted-foreground font-medium">Pending Approval</div>
              <div className="text-3xl font-bold text-foreground mt-1">{analytics?.pendingSongs || 0}</div>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <div className="text-sm text-muted-foreground font-medium">Approved Songs</div>
              <div className="text-3xl font-bold text-foreground mt-1">{analytics?.approvedSongs || 0}</div>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <div className="text-sm text-muted-foreground font-medium">Total Likes</div>
              <div className="text-3xl font-bold text-foreground mt-1">{analytics?.totalLikes?.toLocaleString() || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
