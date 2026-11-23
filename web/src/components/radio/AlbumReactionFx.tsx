'use client';

import { useEffect, useId, useRef, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/utils';

export type AlbumReactionKind = 'fire' | 'shit';

export type AlbumReactionBurst = {
  id: number;
  kind: AlbumReactionKind;
};

let burstSeq = 0;

export function nextAlbumBurst(kind: AlbumReactionKind): AlbumReactionBurst {
  burstSeq += 1;
  return { id: burstSeq, kind };
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

/** Jagged aura tongues. Radii are in a 0–100 viewBox centered on the cover. */
function flameSpikes(count: number, inner: number, outer: number): string[] {
  const paths: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const wobble = ((i * 37) % 10) / 10;
    const spread = 0.1 + wobble * 0.06;
    const len = outer - wobble * 7;
    const base = inner + (i % 2) * 1.4;
    const tip = angle + (i % 2 === 0 ? 0.05 : -0.04);
    const x1 = 50 + Math.cos(angle - spread) * base;
    const y1 = 50 + Math.sin(angle - spread) * base;
    const x2 = 50 + Math.cos(angle + spread) * base;
    const y2 = 50 + Math.sin(angle + spread) * base;
    const xt = 50 + Math.cos(tip) * len;
    const yt = 50 + Math.sin(tip) * len;
    paths.push(
      `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${xt.toFixed(2)} ${yt.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
    );
  }
  return paths;
}

const OUTER_SPIKES = flameSpikes(18, 27, 49);
const INNER_SPIKES = flameSpikes(13, 25, 40);


function FireAura({ gradientId }: { gradientId: string }) {
  const hotId = `${gradientId}-hot`;
  return (
    <div className="album-rx album-rx-fire" data-testid="album-reaction-fx" data-kind="fire" aria-hidden>
      <div className="album-rx-glow" />
      <svg className="album-rx-spikes" viewBox="0 0 100 100">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#ffe566" />
            <stop offset="78%" stopColor="#ffb000" />
            <stop offset="100%" stopColor="#ff5a00" />
          </radialGradient>
          <radialGradient id={hotId} cx="50%" cy="50%" r="50%">
            <stop offset="45%" stopColor="#fffceb" />
            <stop offset="70%" stopColor="#ffe14a" />
            <stop offset="100%" stopColor="#ff9a1a" />
          </radialGradient>
        </defs>
        {OUTER_SPIKES.map((d) => (
          <path key={d} d={d} fill={`url(#${gradientId})`} />
        ))}
      </svg>
      <svg className="album-rx-spikes album-rx-spikes-hot" viewBox="0 0 100 100">
        {INNER_SPIKES.map((d) => (
          <path key={d} d={d} fill={`url(#${hotId})`} />
        ))}
      </svg>
    </div>
  );
}

function TomatoThrow() {
  return (
    <div className="album-rx album-rx-shit" data-testid="album-reaction-fx" data-kind="shit" aria-hidden>
      <div className="album-rx-flight">
        <div className="album-rx-tomato">🍅</div>
      </div>
    </div>
  );
}

function AlbumSplat() {
  return (
    <svg className="album-rx-splat" viewBox="0 0 100 100" aria-hidden>
      <path
        fill="#ff3b2f"
        d="M50 34c8-10 22-6 20 6 10 2 8 16-4 16 2 12-12 16-16 6-12 4-16-10-8-16-6-10 0-16 8-12z"
      />
      <path
        fill="#e10600"
        d="M38 46c-8 2-10 12-4 16 2 8 12 8 14 2 6 4 14-2 10-8 4-6 0-14-8-12-2-6-10-4-12 2z"
      />
      <circle cx="30" cy="38" r="4.2" fill="#ff5144" />
      <circle cx="70" cy="36" r="3.2" fill="#ff5144" />
      <circle cx="74" cy="58" r="2.4" fill="#c40808" />
      <circle cx="28" cy="62" r="2.6" fill="#ff5144" />
      <circle cx="58" cy="28" r="2" fill="#ffb0a4" />
      <ellipse cx="48" cy="48" rx="2.1" ry="1.3" fill="#f6e27a" />
      <ellipse cx="56" cy="44" rx="1.6" ry="1.1" fill="#f6e27a" />
      <ellipse cx="44" cy="54" rx="1.5" ry="1" fill="#f6e27a" />
      <ellipse cx="60" cy="54" rx="1.4" ry="0.9" fill="#f6e27a" />
    </svg>
  );
}

type AlbumReactionHostProps = React.HTMLAttributes<HTMLDivElement> & {
  burst: AlbumReactionBurst | null;
  /** Smaller aura so the bottom-bar thumbnail does not cover transport. */
  compact?: boolean;
  artClassName?: string;
  artRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/**
 * Cover plus a one-shot reaction. Fire wraps the art in a gold aura.
 * Poop throws a tomato that splats on the cover, then fades.
 */
export function AlbumReactionHost({
  burst,
  compact = false,
  className,
  artClassName,
  artRef,
  children,
  ...rest
}: AlbumReactionHostProps) {
  const gradientId = useId().replace(/:/g, '');
  const artNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = artNode.current;
    if (!el || !burst) return;
    el.classList.remove('album-rx-punch', 'album-rx-shake');
    void el.offsetWidth;
    el.classList.add(burst.kind === 'fire' ? 'album-rx-punch' : 'album-rx-shake');
  }, [burst]);

  return (
    <div className={cn('relative overflow-visible', compact && 'album-rx-compact', className)} {...rest}>
      {burst?.kind === 'fire' ? <FireAura key={burst.id} gradientId={gradientId} /> : null}
      <div
        ref={(node) => {
          artNode.current = node;
          assignRef(artRef, node);
        }}
        className={cn('relative z-[1] h-full w-full overflow-hidden', artClassName)}
      >
        {children}
        {burst?.kind === 'fire' ? <div key={`flash-${burst.id}`} className="album-rx-flash" /> : null}
        {burst?.kind === 'shit' ? <AlbumSplat key={`splat-${burst.id}`} /> : null}
      </div>
      {burst?.kind === 'shit' ? <TomatoThrow key={burst.id} /> : null}
    </div>
  );
}
