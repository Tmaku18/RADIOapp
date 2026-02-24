'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLikeEvents } from './useLikeEvents';

type Ping = { id: string; xPct: number; yPct: number; createdAt: number };

function id() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function GlobalVoteMap({ className }: { className?: string }) {
  const [pings, setPings] = useState<Ping[]>([]);

  const addPing = useCallback(() => {
    // No geo in the event payload yet; use a constrained random distribution for visual plausibility.
    const xPct = 10 + Math.random() * 80;
    const yPct = 18 + Math.random() * 64;
    const ping: Ping = { id: id(), xPct, yPct, createdAt: Date.now() };
    setPings((prev) => [...prev.slice(-24), ping]);
    setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== ping.id));
    }, 2500);
  }, []);

  useLikeEvents(addPing);

  const gridBg = useMemo(
    () => ({
      backgroundImage:
        'radial-gradient(circle at 1px 1px, rgba(0,245,255,0.14) 1px, transparent 0)',
      backgroundSize: '22px 22px',
    }),
    [],
  );

  return (
    <div className={className}>
      <div className="rounded-2xl border border-primary/20 bg-background/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-primary/10 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Live activity</div>
            <div className="text-sm font-semibold text-foreground">Global State Visualizer</div>
          </div>
          <div className="text-xs text-muted-foreground">Pings on upvotes</div>
        </div>

        <div className="relative h-44 sm:h-56 bg-gradient-to-br from-primary/10 via-transparent to-transparent" style={gridBg}>
          {/* Soft “continents” silhouette placeholder */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(closest-side at 25% 45%, rgba(0,245,255,0.10), transparent 70%), radial-gradient(closest-side at 55% 40%, rgba(0,245,255,0.08), transparent 68%), radial-gradient(closest-side at 75% 58%, rgba(0,245,255,0.07), transparent 70%)',
            }}
          />

          {pings.map((p) => (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="absolute -inset-3 rounded-full bg-primary/10 animate-ping" />
              <span className="block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_rgba(0,245,255,0.55)]" />
            </div>
          ))}

          <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/80">
            Realtime: `likes` INSERT
          </div>
        </div>
      </div>
    </div>
  );
}

