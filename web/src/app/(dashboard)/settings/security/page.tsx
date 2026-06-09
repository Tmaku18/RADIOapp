'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useAuth();

  const [discoverable, setDiscoverable] = useState(true);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);
  const [discoverableSaved, setDiscoverableSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    setError(null);
    try {
      await usersApi.deleteMyAccount();
      setDeleteOpen(false);
      await signOut();
      router.replace('/login');
    } catch {
      setError('Failed to delete account. Please try again or contact support.');
    } finally {
      setDeleting(false);
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

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Delete account</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account, profile, uploaded songs, library, messages, and
              notification preferences. This cannot be undone.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Type DELETE to confirm permanent account deletion.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
