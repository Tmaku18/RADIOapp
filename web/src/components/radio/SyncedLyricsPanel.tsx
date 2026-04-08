'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { songsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TimedLine {
  startMs: number;
  endMs?: number;
  text: string;
}

interface SyncedLyricsPanelProps {
  songId: string | null | undefined;
  currentTimeMs: number;
  className?: string;
}

export function SyncedLyricsPanel({
  songId,
  currentTimeMs,
  className,
}: SyncedLyricsPanelProps) {
  const [lines, setLines] = useState<TimedLine[] | null>(null);
  const [plainText, setPlainText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);
  const lastSongId = useRef<string | null>(null);

  useEffect(() => {
    if (!songId || songId === lastSongId.current) return;
    lastSongId.current = songId;
    setLines(null);
    setPlainText(null);
    setLoading(true);

    songsApi
      .getLyrics(songId)
      .then((res) => {
        setLines(res.data?.timedLines ?? null);
        setPlainText(res.data?.plainText ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [songId]);

  const activeIndex = useCallback(() => {
    if (!lines) return -1;
    let best = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startMs <= currentTimeMs) best = i;
      else break;
    }
    return best;
  }, [lines, currentTimeMs]);

  const idx = activeIndex();

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [idx]);

  const hasLyrics = (lines && lines.length > 0) || (plainText && plainText.trim());
  if (!hasLyrics && !loading) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card/60 overflow-hidden', className)}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>♪ Lyrics</span>
        <span className="text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div
          ref={containerRef}
          className="max-h-[240px] overflow-y-auto scroll-smooth px-4 pb-4"
        >
          {loading && (
            <p className="text-sm text-muted-foreground animate-pulse py-4">
              Loading lyrics…
            </p>
          )}

          {!loading && lines && lines.length > 0 && (
            <div className="space-y-1">
              {lines.map((line, i) => {
                const isActive = i === idx;
                return (
                  <p
                    key={i}
                    ref={isActive ? activeRef : undefined}
                    className={cn(
                      'text-sm leading-relaxed transition-all duration-300',
                      isActive
                        ? 'text-foreground font-semibold scale-[1.02] origin-left'
                        : i < idx
                          ? 'text-muted-foreground/50'
                          : 'text-muted-foreground',
                    )}
                  >
                    {line.text || '♪'}
                  </p>
                );
              })}
            </div>
          )}

          {!loading && (!lines || lines.length === 0) && plainText && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {plainText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
