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
  return `hsl(${hue}, 70%, 65%)`;
}

/** Twitch-style live chat: scrolling messages + input, polled every few seconds. */
export function LiveChat({ sessionId, artistId }: Props) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [messages]);

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

  return (
    <div className="flex h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-[560px]">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">Live chat</p>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-sm"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No messages yet. Say hello! 👋
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="group break-words leading-snug">
              {m.isHost && (
                <span className="mr-1 rounded bg-primary/20 px-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Host
                </span>
              )}
              <span
                className="font-semibold"
                style={{ color: m.isHost ? undefined : colorForName(m.displayName) }}
              >
                {m.displayName}
              </span>
              <span className="text-muted-foreground">: </span>
              <span className="text-foreground">{m.message}</span>
              {canModerate && (
                <button
                  type="button"
                  onClick={() => void handleDelete(m.id)}
                  className="ml-2 hidden text-[10px] text-destructive group-hover:inline"
                  title="Delete message"
                >
                  remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-2">
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
              className="h-9"
            />
            <Button type="submit" size="sm" disabled={sending || !input.trim()}>
              {sending ? '…' : 'Chat'}
            </Button>
          </form>
        ) : (
          <p className="px-1 py-1.5 text-xs text-muted-foreground">
            Sign in to join the chat.
          </p>
        )}
        {error && <p className="mt-1 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
