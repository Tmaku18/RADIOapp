'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import { DeleteAccountCard } from '@/components/account/DeleteAccountCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SecuritySettingsPage() {
  const { profile, refreshProfile } = useAuth();

  const [discoverable, setDiscoverable] = useState(true);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);
  const [discoverableSaved, setDiscoverableSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDiscoverable(profile?.discoverable !== false);
  }, [profile?.discoverable]);

  const handleDiscoverable = async (enabled: boolean) => {
    setSavingDiscoverable(true);
    setDiscoverableSaved(false);
    setError(null);
    setDiscoverable(enabled);
    try {
      await usersApi.updateMe({ discoverable: enabled });
      await refreshProfile?.();
      setDiscoverableSaved(true);
    } catch {
      setError('Failed to save discoverability setting.');
      setDiscoverable(profile?.discoverable !== false);
    } finally {
      setSavingDiscoverable(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild>
          <Link href="/settings">← Back to Settings</Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Security &amp; Privacy</h1>
        <p className="text-muted-foreground">
          Manage discoverability and account deletion.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {discoverableSaved && (
        <Alert>
          <AlertDescription>Discoverability updated.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="discoverable">Discoverable in heatmap</Label>
              <p className="text-sm text-muted-foreground">
                Allow people nearby to discover you on the artist map and heatmap.
              </p>
            </div>
            <Switch
              id="discoverable"
              checked={discoverable}
              onCheckedChange={(checked) => void handleDiscoverable(checked)}
              disabled={savingDiscoverable}
            />
          </div>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}
