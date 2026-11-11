'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  canSelectAudioOutput,
  chooseHeadphoneOutput,
  detectHeadphoneOutput,
  type HeadphoneDetection,
} from '@/lib/headphone-output';

export function useHeadphones() {
  const [detected, setDetected] = useState<HeadphoneDetection>({ kind: 'unknown' });
  const [assumed, setAssumed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [latchedSink, setLatchedSink] = useState<string | null>(null);
  const [latchedLabel, setLatchedLabel] = useState<string | null>(null);

  const apply = useCallback((next: HeadphoneDetection) => {
    setDetected(next);
    if (next.kind === 'headphones') {
      setLatchedSink(next.deviceId);
      setLatchedLabel(next.label);
      setAssumed(false);
    } else if (next.kind === 'speakers') {
      setLatchedSink(null);
      setLatchedLabel(null);
      setAssumed(false);
    }
  }, []);

  const refresh = useCallback(
    async (prompt: boolean) => {
      setChecking(true);
      try {
        apply(await detectHeadphoneOutput({ prompt }));
      } finally {
        setChecking(false);
      }
    },
    [apply],
  );

  const choose = useCallback(async () => {
    setChecking(true);
    try {
      apply(await chooseHeadphoneOutput());
    } finally {
      setChecking(false);
    }
  }, [apply]);

  useEffect(() => {
    void refresh(false);
    const onChange = () => {
      void refresh(false);
    };
    navigator.mediaDevices?.addEventListener('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onChange);
    };
  }, [refresh]);

  const allowed =
    detected.kind === 'headphones' ||
    (detected.kind === 'unknown' && (assumed || latchedLabel != null));
  const sinkId =
    detected.kind === 'headphones'
      ? detected.deviceId
      : detected.kind === 'unknown'
        ? latchedSink
        : null;

  return {
    detected,
    assumed,
    setAssumed,
    checking,
    refresh,
    choose,
    allowed,
    sinkId,
    latchedLabel,
  };
}

type GateProps = {
  headphones: ReturnType<typeof useHeadphones>;
};

export function HeadphoneGate({ headphones }: GateProps) {
  const { detected, assumed, setAssumed, checking, refresh, choose, latchedLabel } =
    headphones;
  const canChoose = canSelectAudioOutput();

  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      {detected.kind === 'speakers' ? (
        <p className="text-destructive">
          {detected.label || 'Speakers'} are the current output. Plug in
          headphones or a headset to go live — the station would feed back into
          the mic through speakers.
        </p>
      ) : detected.kind === 'headphones' || latchedLabel ? (
        <p className="text-emerald-700 dark:text-emerald-300">
          Headphones connected ({detected.kind === 'headphones' ? detected.label : latchedLabel}).
          You&apos;ll hear the station in your headset while you&apos;re live.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Headphones or a headset are required. You&apos;ll hear what&apos;s
          playing on the station in your ears so it doesn&apos;t feed back into
          the mic.
        </p>
      )}

      {detected.kind !== 'headphones' && !latchedLabel && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => void refresh(true)}
          >
            {checking ? 'Checking…' : 'Check for headphones'}
          </Button>
          {canChoose && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={checking}
              onClick={() => void choose()}
            >
              Choose headphones
            </Button>
          )}
        </div>
      )}

      {detected.kind === 'unknown' && !latchedLabel && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={assumed}
            onChange={(event) => setAssumed(event.target.checked)}
          />
          <span>
            I&apos;m wearing headphones or a headset. This browser can&apos;t
            see the audio output.
          </span>
        </label>
      )}
    </div>
  );
}
