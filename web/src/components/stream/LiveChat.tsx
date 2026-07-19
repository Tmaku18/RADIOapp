'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { artistLiveApi, type StreamChatMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  sessionId: string;
  /** DB id of the host (artist/DJ) so we can show moderation controls. */
  artistId: string;
  /**
   * Render as a semitransparent overlay (Twitch-style) meant to float over the
   * video, rather than as a solid side panel.
   */
  overlay?: boolean;
};

const MAX_MESSAGES = 250;
const POLL_MS = 3000;

/** Deterministic, readable username color (Twitch-style) from the name. */
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 72%)`;
}

/** Twitch-style live chat: scrolling messages + input, polled every few seconds. */
export function LiveChat({ sessionId, artistId, overlay = false }: Props) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const lastTsRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottomRef = useRef(true);

  const isLoggedIn = !!profile;
  const canModerate = profile?.role === 'admin' || profile?.id === artistId;

  const appendMessages = useCallback((incoming: StreamChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (seenIdsRef.current.has(m.id)) continue;
        seenIdsRef.current.add(m.id);
        next.push(m);
        if (m.createdAt > (lastTsRef.current ?? '')) {
          lastTsRef.current = m.createdAt;
        }
      }
      return next.length > MAX_MESSAGES
        ? next.slice(next.length - MAX_MESSAGES)
        : next;
    });
  }, []);

  // Initial load + polling.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await artistLiveApi.listChat(
          sessionId,
          lastTsRef.current ? { after: lastTsRef.current } : { limit: 50 },
        );
        if (!cancelled && res.data?.messages) {
          appendMessages(res.data.messages);
        }
      } catch {
        // Transient errors are fine — next poll resyncs.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, appendMessages]);

  // Auto-scroll to newest unless the viewer scrolled up to read history.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, collapsed]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await artistLiveApi.postChat(sessionId, text);
      if (res.data) appendMessages([res.data]);
      setInput('');
      pinnedToBottomRef.current = true;
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not send message.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await artistLiveApi.deleteChat(sessionId, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // ignore
    }
  };

  // Collapsed overlay: just a small pill to reopen the chat.
  if (overlay && collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/70"
      >
        <span aria-hidden>💬</span> Chat
      </button>
    );
  }

  const containerClass = overlay
    ? 'flex h-full w-full flex-col overflow-hidden rounded-xl bg-black/40 text-white shadow-xl ring-1 ring-white/15 backdrop-blur-md'
    : 'flex h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-[560px]';

  return (
    <div className={containerClass}>
      <div
        className={
          overlay
            ? 'flex items-center justify-between px-3 py-1.5'
            : 'border-b border-border px-3 py-2'
        }
      >
        <p
          className={
            overlay
              ? 'text-xs font-semibold uppercase tracking-wide text-white/90 [text-shadow:_0_1px_2px_rgb(0_0_0_/_70%)]'
              : 'text-sm font-semibold'
          }
        >
          Live chat
        </p>
        {overlay && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-0.5 text-white/70 transition hover:text-white"
            title="Hide chat"
            aria-label="Hide chat"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={
          overlay
            ? 'flex-1 space-y-1 overflow-y-auto px-3 py-1 text-sm [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]'
            : 'flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm'
        }
      >
        {messages.length === 0 ? (
          <p
            className={
              overlay
                ? 'py-6 text-center text-xs text-white/70'
                : 'py-6 text-center text-xs text-muted-foreground'
            }
          >
            No messages yet. Say hello! 👋
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="group break-words leading-snug">
              {m.isHost && (
                <span
                  className={
                    overlay
                      ? 'mr-1 rounded bg-white/25 px-1 text-[10px] font-semibold uppercase tracking-wide text-white'
                      : 'mr-1 rounded bg-primary/20 px-1 text-[10px] font-semibold uppercase tracking-wide text-primary'
                  }
                >
                  Host
                </span>
              )}
              <span
                className="font-semibold"
                style={{
                  color: m.isHost
                    ? overlay
                      ? '#fff'
                      : undefined
                    : colorForName(m.displayName),
                }}
              >
                {m.displayName}
              </span>
              <span className={overlay ? 'text-white/60' : 'text-muted-foreground'}>
                :{' '}
              </span>
              <span className={overlay ? 'text-white' : 'text-foreground'}>
                {m.message}
              </span>
              {canModerate && (
                <button
                  type="button"
                  onClick={() => void handleDelete(m.id)}
                  className={
                    overlay
                      ? 'ml-2 hidden text-[10px] text-red-300 group-hover:inline'
                      : 'ml-2 hidden text-[10px] text-destructive group-hover:inline'
                  }
                  title="Delete message"
                >
                  remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className={overlay ? 'p-2' : 'border-t border-border p-2'}>
        {isLoggedIn ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Send a message"
              className={
                overlay
                  ? 'h-8 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-white/40'
                  : 'h-9'
              }
            />
            <Button type="submit" size="sm" disabled={sending || !input.trim()}>
              {sending ? '…' : 'Chat'}
            </Button>
          </form>
        ) : (
          <p
            className={
              overlay
                ? 'px-1 py-1.5 text-xs text-white/70'
                : 'px-1 py-1.5 text-xs text-muted-foreground'
            }
          >
            Sign in to join the chat.
          </p>
        )}
        {error && (
          <p
            className={
              overlay
                ? 'mt-1 px-1 text-xs text-red-300'
                : 'mt-1 px-1 text-xs text-destructive'
            }
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
