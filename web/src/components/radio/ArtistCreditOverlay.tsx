'use client';

import { useEffect, useRef } from 'react';
import {
  ARTIST_CREDIT_STYLES,
  drawArtistCredit,
  type ArtistCreditStyle,
} from '@/lib/artist-credit';

export function ArtistCreditOverlay({
  title,
  artist,
  style,
  x,
  y,
  scale,
  onMove,
}: {
  title: string;
  artist: string;
  style: ArtistCreditStyle;
  x: number;
  y: number;
  scale: number;
  onMove: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const paint = () => {
      const width = Math.max(1, box.clientWidth);
      const height = Math.max(1, box.clientHeight);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawArtistCredit(ctx, width, height, { title, artist, style, x, y, scale });
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(box);
    return () => observer.disconnect();
  }, [title, artist, style, x, y, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const nextX = Math.min(0.88, Math.max(0.12, x + (event.clientX - current.x) / rect.width));
        const nextY = Math.min(0.88, Math.max(0.12, y + (event.clientY - current.y) / rect.height));
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        onMove(nextX, nextY);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}

export function ArtistCreditTray({
  style,
  scale,
  disabled,
  onStyle,
  onScale,
}: {
  style: ArtistCreditStyle | null;
  scale: number;
  disabled?: boolean;
  onStyle: (style: ArtistCreditStyle | null) => void;
  onScale: (scale: number) => void;
}) {
  const sizes = [
    { id: 0.8, label: 'Small' },
    { id: 1, label: 'Medium' },
    { id: 1.25, label: 'Large' },
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Artist credit</p>
      <p className="text-xs text-white/60">
        Drag it to move it. It is saved onto the clip when you post or share.
      </p>
      <div className="flex flex-wrap gap-2">
        <CreditChip
          label="Off"
          selected={style == null}
          disabled={disabled}
          onClick={() => onStyle(null)}
        />
        {ARTIST_CREDIT_STYLES.map((option) => (
          <CreditChip
            key={option.id}
            label={option.label}
            selected={style === option.id}
            disabled={disabled}
            onClick={() => onStyle(option.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((option) => (
          <CreditChip
            key={option.label}
            label={option.label}
            selected={Math.abs(scale - option.id) < 0.05}
            disabled={disabled || style == null}
            onClick={() => onScale(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CreditChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        selected
          ? 'rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-black disabled:opacity-40'
          : 'rounded-full border border-white/20 px-3 py-1 text-xs text-white disabled:opacity-40'
      }
    >
      {label}
    </button>
  );
}
