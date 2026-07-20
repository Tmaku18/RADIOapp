'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hasArtistCapability } from '@/lib/roles';
import {
  usersApi,
  type ArtistLikeNotificationSettings,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DEFAULT_SETTINGS: ArtistLikeNotificationSettings = {
  muted: false,
  minLikesTrigger: 1,
  cooldownMinutes: 0,
};

export default function NotificationSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const isArtist = hasArtistCapability(profile?.role);

  const [notifyFollowedArtistOnRadio, setNotifyFollowedArtistOnRadio] = useState(
    profile?.notifyFollowedArtistOnRadio !== false,
  );
  const [savingFollowedRadio, setSavingFollowedRadio] = useState(false);
  const [followedRadioSaved, setFollowedRadioSaved] = useState(false);

  const [settings, setSettings] =
    useState<ArtistLikeNotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotifyFollowedArtistOnRadio(profile?.notifyFollowedArtistOnRadio !== false);
  }, [profile?.notifyFollowedArtistOnRadio]);

  useEffect(() => {
    const load = async () => {
      if (!isArtist) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.getArtistLikeNotificationSettings();
        setSettings(res.data ?? DEFAULT_SETTINGS);
      } catch {
        setError('Failed to load notification settings.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isArtist]);

  const handleSaveFollowedRadio = async (enabled: boolean) => {
    setSavingFollowedRadio(true);
    setFollowedRadioSaved(false);
    setError(null);
    try {
      await usersApi.updateMe({ notifyFollowedArtistOnRadio: enabled });
      setNotifyFollowedArtistOnRadio(enabled);
      await refreshProfile?.();
      setFollowedRadioSaved(true);
    } catch {
      setError('Failed to save followed-artist radio alerts.');
      setNotifyFollowedArtistOnRadio(profile?.notifyFollowedArtistOnRadio !== false);
    } finally {
      setSavingFollowedRadio(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await usersApi.updateArtistLikeNotificationSettings(settings);
      setSettings(res.data ?? settings);
      setSaved(true);
    } catch {
      setError('Failed to save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild>
          <Link href="/settings">← Back to Settings</Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Notification settings</h1>
        <p className="text-muted-foreground">
          Control alerts for followed artists and, if you are an artist, song likes.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {followedRadioSaved && (
        <Alert>
          <AlertDescription>Followed-artist radio alerts updated.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="followed-radio">Followed artists on radio</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone you follow is about to play or is on-air on any station.
              </p>
            </div>
            <Switch
              id="followed-radio"
              checked={notifyFollowedArtistOnRadio}
              onCheckedChange={(checked) => {
                setNotifyFollowedArtistOnRadio(checked);
                void handleSaveFollowedRadio(checked);
              }}
              disabled={savingFollowedRadio}
            />
          </div>
        </CardContent>
      </Card>

      {isArtist && (
        <>
          {saved && (
            <Alert>
              <AlertDescription>Artist like settings saved.</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Song likes (artists)</h2>
                <p className="text-sm text-muted-foreground">
                  Control how often you are notified when listeners like your songs.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="mute-likes">Mute song-like notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn this on to stop all notifications for new likes.
                  </p>
                </div>
                <Switch
                  id="mute-likes"
                  checked={settings.muted}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, muted: checked }))
                  }
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-trigger">
                  Minimum likes before notifying
                </Label>
                <Input
                  id="min-trigger"
                  type="number"
                  min={1}
                  max={1000}
                  value={settings.minLikesTrigger}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      minLikesTrigger: Math.max(
                        1,
                        Number.parseInt(e.target.value || '1', 10) || 1,
                      ),
                    }))
                  }
                  disabled={loading || saving}
                />
                <p className="text-sm text-muted-foreground">
                  Example: set to 5 to get notified on 5, 10, 15 likes instead of every single like.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cooldown-minutes">Minimum time between notifications (minutes)</Label>
                <Input
                  id="cooldown-minutes"
                  type="number"
                  min={0}
                  max={10080}
                  value={settings.cooldownMinutes}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      cooldownMinutes: Math.max(
                        0,
                        Number.parseInt(e.target.value || '0', 10) || 0,
                      ),
                    }))
                  }
                  disabled={loading || saving}
                />
                <p className="text-sm text-muted-foreground">
                  Set to 0 for no cooldown. Example: 60 means at most one notification per hour.
                </p>
              </div>

              <Button onClick={handleSave} disabled={loading || saving}>
                {saving ? 'Saving...' : 'Save artist like settings'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
