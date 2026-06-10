'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { djBoothApi } from '@/lib/api';
import { CameraBroadcaster } from '@/components/stream/CameraBroadcaster';

type Props = {
  stationId: string;
  micActive: boolean;
  duckVolume: number;
  whipUrl: string | null;
  sessionConnected: boolean;
  onRefresh: () => void;
};

export function MicPanel({
  stationId,
  micActive,
  duckVolume,
  whipUrl,
  sessionConnected,
  onRefresh,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [localDuck, setLocalDuck] = useState(duckVolume);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await djBoothApi.createMicSession(stationId);
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect mic');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await djBoothApi.deleteMicSession(stationId);
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    setBusy(true);
    setError(null);
    try {
      if (micActive) {
        await djBoothApi.micOff(stationId);
      } else {
        await djBoothApi.micOn(stationId);
      }
      onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mic toggle failed');
    } finally {
      setBusy(false);
    }
  };

  const saveDuck = useCallback(async () => {
    setBusy(true);
    try {
      await djBoothApi.setDuckVolume(stationId, localDuck);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }, [localDuck, onRefresh, stationId]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-lg">Mic Booth</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            micActive ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
          }`}
        >
          {micActive ? 'ON AIR' : 'OFF AIR'}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!sessionConnected ? (
          <Button type="button" disabled={busy} onClick={connect}>
            Connect Mic
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={disconnect}>
              Disconnect
            </Button>
            <Button
              type="button"
              variant={micActive ? 'destructive' : 'default'}
              disabled={busy}
              onClick={toggleMic}
            >
              {micActive ? 'Mic Off' : 'Mic On'}
            </Button>
          </>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Music duck level while mic is on: {Math.round(localDuck * 100)}%
        </label>
        <input
          type="range"
          min={0.05}
          max={0.5}
          step={0.05}
          value={localDuck}
          onChange={(e) => setLocalDuck(parseFloat(e.target.value))}
          onMouseUp={saveDuck}
          onTouchEnd={saveDuck}
          className="w-full"
        />
      </div>

      {whipUrl && sessionConnected && (
        <div className="rounded-lg border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            Audio-only broadcast to station listeners (Cloudflare WHIP).
          </p>
          <CameraBroadcaster whipUrl={whipUrl} startCameraOff />
        </div>
      )}
    </Card>
  );
}
