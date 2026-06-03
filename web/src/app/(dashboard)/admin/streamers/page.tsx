'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi, artistLiveApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Application = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string | null;
  appliedAt: string;
};

type LiveSession = {
  sessionId: string;
  artistId: string;
  displayName: string;
  title: string | null;
  currentViewers: number;
  startedAt: string;
  hostRole?: string;
};

export default function AdminStreamersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    load();
    loadLive();
    const timer = setInterval(loadLive, 15000);
    return () => clearInterval(timer);
  }, [profile, router]);

  const load = async () => {
    try {
      const res = await adminApi.getStreamerApplications();
      const data = res.data as { applications: Application[] };
      setApplications(data?.applications ?? []);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLive = async () => {
    try {
      const res = await artistLiveApi.listSessions();
      setLiveSessions((res.data?.sessions as LiveSession[]) ?? []);
    } catch {
      setLiveSessions([]);
    }
  };

  const handleEndStream = async (sessionId: string) => {
    if (
      !window.confirm(
        'End this stream for everyone? The broadcaster will be cut off immediately.',
      )
    ) {
      return;
    }
    setEndingId(sessionId);
    try {
      await artistLiveApi.adminForceStop(sessionId);
      setLiveSessions((prev) =>
        prev.filter((s) => s.sessionId !== sessionId),
      );
    } finally {
      setEndingId(null);
    }
  };

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    setActing(userId);
    try {
      await adminApi.setStreamerApproval(userId, action);
      await load();
    } finally {
      setActing(null);
    }
  };

  if (profile && profile.role !== 'admin') return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Live now</h1>
        <p className="text-muted-foreground">
          Streams currently broadcasting. End a stream to cut off the
          broadcaster immediately.
        </p>
        {liveSessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No active streams.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {liveSessions.map((s) => (
              <Card key={s.sessionId} className="border-border">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/watch/${s.artistId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {s.title || s.displayName}
                      </Link>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {s.hostRole ?? 'artist'}
                      </Badge>
                      <Badge className="bg-red-600 text-white text-xs">
                        ● Live
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {s.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.currentViewers} watching · started{' '}
                      {new Date(s.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/watch/${s.artistId}`}>Watch</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleEndStream(s.sessionId)}
                      disabled={endingId === s.sessionId}
                    >
                      {endingId === s.sessionId ? 'Ending…' : 'End stream'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold text-foreground">Streamer applications</h1>
      <p className="text-muted-foreground">
        Artists and Catalysts who requested streaming access. Approve to let them go live; reject to deny.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending applications.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.userId} className="border-border">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/users/${app.userId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {app.displayName || app.email || app.userId}
                    </Link>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {app.role?.replace('_', ' ') ?? '—'}
                    </Badge>
                  </div>
                  {app.email && (
                    <p className="text-sm text-muted-foreground mt-0.5">{app.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Applied {new Date(app.appliedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(app.userId, 'approve')}
                    disabled={acting === app.userId}
                    className="bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {acting === app.userId ? '…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(app.userId, 'reject')}
                    disabled={acting === app.userId}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
