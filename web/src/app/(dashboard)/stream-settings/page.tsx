'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { artistLiveApi } from '@/lib/api';
import { GoLiveSheet } from '@/components/stream/GoLiveSheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type StreamerStatus = {
  canStream: boolean;
  appliedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  role: string;
};

export default function StreamSettingsPage() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<StreamerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const canApply =
    profile?.role === 'artist' || profile?.role === 'service_provider';

  useEffect(() => {
    let cancelled = false;
    artistLiveApi
      .getStreamerStatus()
      .then((res) => {
        const data = res.data as StreamerStatus;
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await artistLiveApi.applyToStream();
      const res = await artistLiveApi.getStreamerStatus();
      setStatus(res.data as StreamerStatus);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canApply) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Stream settings</h1>
        <Alert>
          <AlertDescription>
            Only artists and Catalysts (service providers) can request streaming access. Upgrade your account or switch role in profile settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!status?.canStream && !status?.appliedAt && !status?.rejectedAt) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Stream settings</h1>
        <p className="text-muted-foreground">
          Request access to go live. An admin must approve your application before you can start streaming.
        </p>
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <Button
              onClick={handleApply}
              disabled={applying}
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {applying ? 'Submitting...' : 'Request streaming access'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status.appliedAt && !status.approvedAt && !status.rejectedAt) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Stream settings</h1>
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription>
            Your request is pending. An admin will review it soon. You’ll be able to go live and manage stream info here once approved.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          Applied on {new Date(status.appliedAt).toLocaleDateString()}.
        </p>
      </div>
    );
  }

  if (status.rejectedAt) {
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Stream settings</h1>
        <Alert variant="destructive">
          <AlertDescription>
            Your streaming application was not approved. You can reapply below; an admin will review again.
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleApply}
          disabled={applying}
          variant="outline"
        >
          {applying ? 'Submitting...' : 'Reapply for streaming access'}
        </Button>
      </div>
    );
  }

  // Approved: show Stream Manager and links
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Stream settings</h1>
      <p className="text-muted-foreground">
        Manage your livestream. Edit stream info and start or end your stream from here.
      </p>

      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => setSheetOpen(true)}
              className="w-full bg-primary text-primary-foreground hover:opacity-90"
            >
              Open Stream Manager
            </Button>
            <p className="text-xs text-muted-foreground">
              Set title, description, and category, then start or end your stream.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-foreground mb-2">Live services</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Schedule live events and view encoder details (RTMP URL and stream key are created when you start a stream).
          </p>
          <Button variant="outline" asChild>
            <Link href="/artist/live-services">Open Live services</Link>
          </Button>
        </CardContent>
      </Card>

      <GoLiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        artistId={profile?.id ?? null}
      />
    </div>
  );
}
