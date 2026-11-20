'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  ARTIST_CREDIT_STYLES,
  drawArtistCredit,
  type ArtistCreditStyle,
  type ClipWord,
} from '@/lib/artist-credit';

export type { ClipWord };

export function ArtistCreditOverlay({
  title,
  artist,
  style,
  x,
  y,
  scale,
}: {
  title: string;
  artist: string;
  style: ArtistCreditStyle;
  x: number;
  y: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      data-stage="1"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

const SCALE_MIN = 0.4;
const SCALE_MAX = 3.5;

/** Drag with one finger and pinch with two. A short tap can edit the sticker. */
export function StickerHandle({
  x,
  y,
  scale,
  disabled,
  className,
  children,
  onMove,
  onScale,
  onTap,
}: {
  x: number;
  y: number;
  scale: number;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onMove: (x: number, y: number) => void;
  onScale: (scale: number) => void;
  onTap?: () => void;
}) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ dist: number; scale: number } | null>(null);
  const moved = useRef(false);
  const pos = useRef({ x, y, scale });
  if (pointers.current.size === 0) pos.current = { x, y, scale };

  const distance = () => {
    const points = [...pointers.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  return (
    <div
      className={`absolute touch-none ${className ?? ''}`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={(event) => {
        if (disabled) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        moved.current = false;
        if (pointers.current.size === 1) pos.current = { x, y, scale };
        if (pointers.current.size === 2) {
          start.current = { dist: Math.max(1, distance()), scale: pos.current.scale };
        }
      }}
      onPointerMove={(event) => {
        const current = pointers.current.get(event.pointerId);
        if (!current || disabled) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (Math.hypot(dx, dy) > 4) moved.current = true;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const rect = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        if (pointers.current.size >= 2 && start.current && start.current.dist > 0) {
          const next = Math.min(
            SCALE_MAX,
            Math.max(SCALE_MIN, start.current.scale * (distance() / start.current.dist)),
          );
          pos.current.scale = next;
          onScale(next);
          return;
        }
        pos.current.x = Math.min(0.92, Math.max(0.08, pos.current.x + dx / rect.width));
        pos.current.y = Math.min(0.92, Math.max(0.08, pos.current.y + dy / rect.height));
        onMove(pos.current.x, pos.current.y);
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) start.current = null;
        if (!moved.current && pointers.current.size === 0) onTap?.();
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        start.current = null;
      }}
    >
      {children}
    </div>
  );
}

export function ClipWordView({
  word,
  stageSize,
  disabled,
  onMove,
  onScale,
  onTap,
}: {
  word: ClipWord;
  stageSize: number;
  disabled?: boolean;
  onMove: (x: number, y: number) => void;
  onScale: (scale: number) => void;
  onTap: () => void;
}) {
  const fontSize = Math.min(220, Math.max(14, stageSize * 0.055 * word.scale));
  return (
    <StickerHandle
      x={word.x}
      y={word.y}
      scale={word.scale}
      disabled={disabled}
      onMove={onMove}
      onScale={onScale}
      onTap={onTap}
    >
      <span
        className="block max-w-[90vw] select-none text-center font-extrabold leading-tight text-white"
        style={{
          fontSize,
          textShadow: '0 2px 0 rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.65)',
        }}
      >
        {word.text}
      </span>
    </StickerHandle>
  );
}

export function ArtistCreditTray({
  style,
  disabled,
  onStyle,
}: {
  style: ArtistCreditStyle | null;
  disabled?: boolean;
  onStyle: (style: ArtistCreditStyle | null) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Artist credit</p>
      <p className="text-xs text-white/60">
        Drag it to move it and pinch to resize. Tap the video to type your own words.
        The caption below stays separate.
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
