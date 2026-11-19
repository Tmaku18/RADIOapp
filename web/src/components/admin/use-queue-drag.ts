'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';

/**
 * Pointer drag for a long queue list. The list element must scroll
 * (`overflow-y: auto`) so holding a row against the top or bottom edge
 * keeps the list moving in that direction.
 */
export function useQueueDrag(onReorder: (from: number, to: number) => void) {
  const listRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<number | null>(null);
  const dirRef = useRef(0);
  const speedRef = useRef(0);
  const pointRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const stopScroll = () => {
    dirRef.current = 0;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const ensureScroll = () => {
    if (rafRef.current != null) return;
    const tick = () => {
      const node = listRef.current;
      if (!node || dirRef.current === 0) {
        rafRef.current = null;
        return;
      }
      node.scrollTop += dirRef.current * speedRef.current;
      consider(pointRef.current.x, pointRef.current.y);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const nudge = (clientY: number) => {
    const node = listRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const edge = 72;
    if (clientY < rect.top + edge) {
      dirRef.current = -1;
      speedRef.current = Math.max(8, ((rect.top + edge - clientY) / edge) * 26);
      ensureScroll();
      return;
    }
    if (clientY > rect.bottom - edge) {
      dirRef.current = 1;
      speedRef.current = Math.max(8, ((clientY - (rect.bottom - edge)) / edge) * 26);
      ensureScroll();
      return;
    }
    stopScroll();
  };

  const consider = (clientX: number, clientY: number) => {
    const from = fromRef.current;
    if (from == null) return;
    const hit = document.elementFromPoint(clientX, clientY);
    const row = hit?.closest<HTMLElement>('[data-queue-index]');
    if (!row) return;
    const to = Number(row.dataset.queueIndex);
    if (!Number.isFinite(to) || to === from) return;
    const rect = row.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (from < to && clientY < mid) return;
    if (from > to && clientY > mid) return;
    fromRef.current = to;
    reorderRef.current(from, to);
  };

  const end = () => {
    fromRef.current = null;
    setDraggingIndex(null);
    stopScroll();
  };

  useEffect(() => () => stopScroll(), []);

  return {
    listRef,
    draggingIndex,
    handleProps: (index: number) => ({
      type: 'button' as const,
      'aria-label': 'Drag to reorder',
      className:
        'cursor-grab touch-none select-none rounded px-1 text-lg leading-none text-muted-foreground active:cursor-grabbing',
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        fromRef.current = index;
        setDraggingIndex(index);
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        if (fromRef.current == null) return;
        pointRef.current = { x: event.clientX, y: event.clientY };
        nudge(event.clientY);
        consider(event.clientX, event.clientY);
      },
      onPointerUp: end,
      onPointerCancel: end,
    }),
  };
}
