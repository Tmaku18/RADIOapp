'use client';

import { Button } from '@/components/ui/button';

type Props = {
  transportPaused: boolean;
  busy: boolean;
  onBack: () => void;
  onTogglePlay: () => void;
  onSkip: () => void;
};

export function TransportControls({
  transportPaused,
  busy,
  onBack,
  onTogglePlay,
  onSkip,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={onBack}>
        ◀ Back
      </Button>
      <Button type="button" variant="default" disabled={busy} onClick={onTogglePlay}>
        {transportPaused ? '▶ Play for everyone' : '⏸ Pause for everyone'}
      </Button>
      <Button type="button" variant="outline" disabled={busy} onClick={onSkip}>
        Skip ▶
      </Button>
      <p className="text-xs text-muted-foreground w-full mt-1">
        Global transport — affects all listeners on this station.
      </p>
    </div>
  );
}
