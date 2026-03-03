'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api';
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

export default function AdminStreamersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    load();
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
