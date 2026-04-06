'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi, usersApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalSongs: number;
  totalPlays: number;
  totalListenCount?: number;
  pendingSongs: number;
  approvedSongs: number;
  totalLikes: number;
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [adminRoleHint, setAdminRoleHint] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<{ active: boolean; startedAt?: string } | null>(null);
  const [liveActionLoading, setLiveActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retry: NodeJS.Timeout | null = null;
    const resolveAdmin = async () => {
      // Explicit non-admin role: bounce immediately.
      if (profile && profile.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      // Known admin profile.
      if (profile?.role === 'admin') {
        if (!cancelled) {
          setAdminRoleHint(true);
          loadAnalytics();
        }
        return;
      }
      // Profile not hydrated yet: use backend allowlist hint.
      try {
        const res = await usersApi.checkAdmin();
        const isAdmin = !!res.data?.isAdmin;
        if (cancelled) return;
        if (isAdmin) {
          setAdminRoleHint(true);
          loadAnalytics();
          return;
        }
        // When profile is still unresolved, do not prematurely redirect.
        if (profile) {
          router.push('/dashboard');
          return;
        }
        retry = setTimeout(() => {
          if (!cancelled) void resolveAdmin();
        }, 10000);
      } catch {
        // Keep page alive and retry; transient auth/network errors are common here.
        retry = setTimeout(() => {
          if (!cancelled) void resolveAdmin();
        }, 10000);
      }
    };
    resolveAdmin();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [profile, router]);

  useEffect(() => {
    if (!(profile?.role === 'admin' || adminRoleHint)) return;
    adminApi.getLiveStatus()
      .then((res) => setLiveStatus(res.data))
      .catch(() => setLiveStatus({ active: false }));
  }, [profile?.role, adminRoleHint]);

  const handleStartLive = async () => {
    setLiveActionLoading(true);
    try {
      await adminApi.startLive();
      setLiveStatus({ active: true, startedAt: new Date().toISOString() });
    } catch (e) {
      console.error(e);
    } finally {
      setLiveActionLoading(false);
    }
  };

  const handleStopLive = async () => {
    setLiveActionLoading(true);
    try {
      await adminApi.stopLive();
      setLiveStatus({ active: false });
    } catch (e) {
      console.error(e);
    } finally {
      setLiveActionLoading(false);
    }
  };

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
              <div className="text-sm text-muted-foreground">Gems</div>
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
              <div className="text-sm text-muted-foreground">Total listens</div>
              <div className="text-2xl font-bold text-foreground">{(analytics?.totalListenCount ?? analytics?.totalPlays ?? 0).toLocaleString()}</div>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Live broadcast</h2>
          <p className="text-muted-foreground text-sm mb-4">Start or stop a live broadcast. Listeners will see a &quot;Live broadcast&quot; indicator on the Listen page.</p>
          {liveStatus?.active ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">Live now</Badge>
              {liveStatus.startedAt && (
                <span className="text-sm text-muted-foreground">
                  Started {new Date(liveStatus.startedAt).toLocaleString()}
                </span>
              )}
              <Button variant="destructive" size="sm" onClick={handleStopLive} disabled={liveActionLoading}>
                {liveActionLoading ? 'Stopping…' : 'Stop broadcast'}
              </Button>
            </div>
          ) : (
            <Button onClick={handleStartLive} disabled={liveActionLoading}>
              {liveActionLoading ? 'Starting…' : 'Go live'}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <Link href="/admin/swipe">
            <CardContent className="pt-6 hover:bg-muted/50 transition-colors">
              <div className="mb-4"><span className="text-3xl">🃏</span></div>
              <h3 className="text-lg font-semibold text-foreground">Swipe</h3>
              <p className="text-muted-foreground text-sm mt-1">Manage discover cards and delete clips</p>
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
              <div className="text-sm text-muted-foreground font-medium">Total Ripples</div>
              <div className="text-3xl font-bold text-foreground mt-1">{analytics?.totalLikes?.toLocaleString() || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
