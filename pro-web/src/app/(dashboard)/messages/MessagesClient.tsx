'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, creatorNetworkApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConversationSummary {
  otherUserId: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
}

interface MessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  );
}

export function MessagesClient() {
  const searchParams = useSearchParams();
  const withUserId = searchParams.get('with');
  const { profile } = useAuth();
  const myId = profile?.id ?? null;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedOther, setSelectedOther] = useState<{ userId: string; displayName: string | null; avatarUrl: string | null } | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [hasCreatorAccess, setHasCreatorAccess] = useState<boolean | null>(null);
  const [paywallShown, setPaywallShown] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await messagesApi.listConversations();
      setConversations(res.data as ConversationSummary[]);
    } catch (e) {
      console.error('Failed to load conversations:', e);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadAccess = useCallback(async () => {
    try {
      const res = await creatorNetworkApi.getAccess();
      setHasCreatorAccess((res.data as { hasAccess: boolean }).hasAccess);
    } catch {
      setHasCreatorAccess(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadAccess();
  }, [loadConversations, loadAccess]);

  const loadThread = useCallback(async (otherUserId: string) => {
    if (!otherUserId) return;
    setLoadingThread(true);
    try {
      const res = await messagesApi.getThread(otherUserId, { limit: 100 });
      setMessages((res.data as MessageRow[]) ?? []);
    } catch (e) {
      console.error('Failed to load thread:', e);
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (withUserId) {
      const conv = conversations.find((c) => c.otherUserId === withUserId);
      setSelectedOther({
        userId: withUserId,
        displayName: conv?.otherDisplayName ?? null,
        avatarUrl: conv?.otherAvatarUrl ?? null,
      });
      if (!conv) {
        usersApi
          .getById(withUserId)
          .then((r) => {
            const d = r.data as { displayName?: string | null; avatarUrl?: string | null };
            setSelectedOther((prev) =>
              prev?.userId === withUserId
                ? { ...prev, displayName: d?.displayName ?? null, avatarUrl: d?.avatarUrl ?? null }
                : prev,
            );
          })
          .catch(() => {});
      }
    }
  }, [withUserId, conversations]);

  useEffect(() => {
    if (selectedOther?.userId) loadThread(selectedOther.userId);
  }, [selectedOther?.userId, loadThread]);

  useEffect(() => {
    if (withUserId && conversations.length > 0) {
      const conv = conversations.find((c) => c.otherUserId === withUserId);
      if (conv && selectedOther?.userId === withUserId) {
        setSelectedOther((prev) => (prev ? { ...prev, displayName: conv.otherDisplayName, avatarUrl: conv.otherAvatarUrl } : null));
      }
    }
  }, [withUserId, conversations, selectedOther?.userId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !selectedOther || sending) return;
    setSending(true);
    setPaywallShown(false);
    try {
      await messagesApi.sendMessage(selectedOther.userId, body);
      setDraft('');
      const newMsg: MessageRow = {
        id: `temp-${Date.now()}`,
        senderId: myId!,
        recipientId: selectedOther.userId,
        body,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      loadConversations();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setPaywallShown(true);
        loadAccess();
      }
    } finally {
      setSending(false);
    }
  };

  const openConversation = (c: ConversationSummary) => {
    setSelectedOther({
      userId: c.otherUserId,
      displayName: c.otherDisplayName,
      avatarUrl: c.otherAvatarUrl,
    });
    setPaywallShown(false);
  };

  return (
    <div className="container max-w-4xl py-6">
      <div className="grid gap-4 md:grid-cols-[300px_1fr] min-h-[65vh]">
        <Card className="md:col-span-1 glass-panel border border-primary/20">
          <CardContent className="p-0">
            <div className="p-3 border-b border-border/60">
              <h2 className="font-semibold text-sm tracking-tight">Smart Inbox</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Active Projects • New Leads</p>
            </div>
            {loadingConversations ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No conversations yet. Send a Ripple from the directory.</div>
            ) : (
              <ul className="divide-y">
                {conversations.map((c) => (
                  <li key={c.otherUserId}>
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors ${
                        selectedOther?.userId === c.otherUserId ? 'bg-muted/60' : ''
                      }`}
                    >
                      {c.otherAvatarUrl ? (
                        <Image src={c.otherAvatarUrl} alt="" width={40} height={40} className="rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted shrink-0 flex items-center justify-center text-lg">👤</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.otherDisplayName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.lastMessageFromMe ? 'You: ' : ''}
                          {c.lastMessagePreview || 'No messages'}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(c.lastMessageAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[420px] glass-panel border border-primary/20 overflow-hidden">
          <CardContent className="flex flex-col flex-1 p-0 flex min-h-0">
            {!selectedOther ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
                Select a thread or browse the <Link href="/directory" className="text-primary underline ml-1">directory</Link>.
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border/60 flex items-center gap-3">
                  <Link href={`/u/${selectedOther.userId}`} className="flex items-center gap-3 shrink-0">
                    {selectedOther.avatarUrl ? (
                      <Image src={selectedOther.avatarUrl} alt="" width={36} height={36} className="rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">👤</div>
                    )}
                    <span className="font-medium">{selectedOther.displayName || 'Unknown'}</span>
                  </Link>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/u/${selectedOther.userId}`}>View profile</Link>
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-[color:var(--rose-gold)] shadow-[0_0_10px_rgba(204,255,0,0.25)]" />
                      Live
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {loadingThread ? (
                    <div className="flex justify-center py-8 text-muted-foreground">Loading messages...</div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderId === myId;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 border ${
                              isMe
                                ? 'bg-primary text-primary-foreground border-primary/40 shadow-[var(--brand-glow)]'
                                : 'bg-muted/40 border-border/60'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{formatTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                {paywallShown && (
                  <Alert variant="destructive" className="mx-4 mt-2">
                    <AlertDescription>
                      Sending messages requires a Creator Network subscription. <Link href="/profile" className="underline font-medium">Upgrade in Profile</Link> to unlock DMs.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-3 border-t border-border/60 flex gap-2">
                  <Input
                    placeholder="Send a Ripple…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={hasCreatorAccess === false}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!draft.trim() || sending || hasCreatorAccess === false}>
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                {hasCreatorAccess === false && (
                  <p className="text-xs text-muted-foreground px-3 pb-2">
                    <Link href="/profile" className="text-primary underline">Subscribe to Creator Network</Link> to send messages.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

