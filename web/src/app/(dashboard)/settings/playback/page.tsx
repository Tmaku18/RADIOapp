'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getStationAutoplayEnabled,
  setStationAutoplayEnabled,
} from '@/lib/playback-preferences';

export default function PlaybackSettingsPage() {
  const [stationAutoplay, setStationAutoplay] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStationAutoplay(getStationAutoplayEnabled());
  }, []);

  const handleStationAutoplay = (enabled: boolean) => {
    setStationAutoplay(enabled);
    setStationAutoplayEnabled(enabled);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" asChild>
          <Link href="/settings">← Back to Settings</Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Playback</h1>
        <p className="text-muted-foreground">
          Control how radio playback starts on the web app.
        </p>
      </div>

      {saved && (
        <Alert>
          <AlertDescription>Playback preference saved.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="station-autoplay">Auto-play when selecting a station</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, tapping a station in Discover opens Listen and starts playback
                immediately. When disabled, Listen opens paused until you press play.
              </p>
            </div>
            <Switch
              id="station-autoplay"
              checked={stationAutoplay}
              onCheckedChange={handleStationAutoplay}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
