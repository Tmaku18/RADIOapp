'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, usersApi } from '@/lib/api';
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
  unreadCount: number;
  lastMessageType: 'text' | 'image' | 'video' | 'voice';
  lastMessageStatus: 'sent' | 'delivered' | 'read';
}

interface MessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  messageType: 'text' | 'image' | 'video' | 'voice';
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaDurationMs: number | null;
  replyToMessageId: string | null;
  editedAt: string | null;
  unsentAt: string | null;
  status: 'sent' | 'delivered' | 'read';
  reactions: Array<{ emoji: string; userId: string; createdAt: string }>;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const withUserId = searchParams.get('with');
  const { profile } = useAuth();
  const myId = profile?.id ?? null;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedOther, setSelectedOther] = useState<{ userId: string; displayName: string | null; avatarUrl: string | null } | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [typingOther, setTypingOther] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canDm, setCanDm] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await messagesApi.listConversations({ search: search.trim() || undefined });
      setConversations(res.data as ConversationSummary[]);
    } catch (e) {
      console.error('Failed to load conversations:', e);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadThread = useCallback(
    async (otherUserId: string) => {
      if (!otherUserId) return;
      setLoadingThread(true);
      try {
        const res = await messagesApi.getThread(otherUserId, { limit: 100 });
        const rows = (res.data as MessageRow[]) ?? [];
        setMessages(rows);
        if (rows.length > 0) {
          const lastMessageId = rows[rows.length - 1]?.id;
          await messagesApi.markThreadRead(otherUserId, lastMessageId);
          loadConversations();
        }
      } catch (e) {
        console.error('Failed to load thread:', e);
        setMessages([]);
      } finally {
        setLoadingThread(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (withUserId) {
      const conv = conversations.find((c) => c.otherUserId === withUserId);
      setSelectedOther({
        userId: withUserId,
        displayName: conv?.otherDisplayName ?? null,
        avatarUrl: conv?.otherAvatarUrl ?? null,
      });
      if (!conv) {
        usersApi.getById(withUserId).then((r) => {
          const d = r.data as { displayName?: string | null; avatarUrl?: string | null };
          setSelectedOther((prev) => (prev?.userId === withUserId ? { ...prev, displayName: d?.displayName ?? null, avatarUrl: d?.avatarUrl ?? null } : prev));
        }).catch(() => {});
      }
    }
  }, [withUserId, conversations]);

  useEffect(() => {
    if (selectedOther?.userId) {
      loadThread(selectedOther.userId);
    }
  }, [selectedOther?.userId, loadThread]);

  useEffect(() => {
    let alive = true;
    if (!selectedOther?.userId || !myId || selectedOther.userId === myId) {
      setCanDm(false);
      return;
    }
    usersApi
      .isFollowing(selectedOther.userId)
      .then((res) => {
        if (!alive) return;
        setCanDm(Boolean((res.data as { following?: boolean })?.following));
      })
      .catch(() => {
        if (alive) setCanDm(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedOther?.userId, myId]);

  useEffect(() => {
    if (withUserId && conversations.length > 0) {
      const conv = conversations.find((c) => c.otherUserId === withUserId);
      if (conv && selectedOther?.userId === withUserId) {
        setSelectedOther((prev) => (prev ? { ...prev, displayName: conv.otherDisplayName, avatarUrl: conv.otherAvatarUrl } : null));
      }
    }
  }, [withUserId, conversations]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!myId || !selectedOther?.userId || !supabaseUrl || !supabaseAnonKey) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel(`dm-updates-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages', filter: `sender_id=eq.${myId}` }, () => {
        loadConversations();
        if (selectedOther?.userId) void loadThread(selectedOther.userId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_messages', filter: `recipient_id=eq.${myId}` }, () => {
        loadConversations();
        if (selectedOther?.userId) void loadThread(selectedOther.userId);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [myId, selectedOther?.userId, loadConversations, loadThread]);

  useEffect(() => {
    if (!myId || !selectedOther?.userId || !supabaseUrl || !supabaseAnonKey) return;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const pair = [myId, selectedOther.userId].sort().join('__');
    const channel = supabase.channel(`dm-typing-${pair}`);
    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const from = (payload.payload as { fromUserId?: string })?.fromUserId;
        if (!from || from === myId) return;
        setTypingOther(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingOther(false), 1800);
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      channel.unsubscribe();
      typingChannelRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [myId, selectedOther?.userId]);

  useEffect(() => {
    if (!selectedOther?.userId) return;
    const interval = setInterval(() => {
      loadConversations();
      loadThread(selectedOther.userId);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedOther?.userId, loadConversations, loadThread]);

  const resolveMessageType = (file: File): 'image' | 'video' | 'voice' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'voice';
  };

  const uploadAttachment = async (file: File): Promise<{ mediaUrl: string; messageType: 'image' | 'video' | 'voice' }> => {
    const uploadUrl = await messagesApi.getUploadUrl({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
    });
    const { signedUrl, path } = uploadUrl.data as { signedUrl: string; path: string };
    setUploadProgress(10);
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }
    setUploadProgress(90);
    const base = (supabaseUrl || '').replace(/\/$/, '');
    const mediaUrl = `${base}/storage/v1/object/public/dm-media/${path}`;
    return { mediaUrl, messageType: resolveMessageType(file) };
  };

  const handleSend = async () => {
    const body = draft.trim();
    if ((!body && !attachment) || !selectedOther || sending || !canDm) return;
    setSending(true);
    setError(null);
    try {
      let messagePayload: {
        body?: string;
        messageType?: 'text' | 'image' | 'video' | 'voice';
        mediaUrl?: string | null;
        mediaMime?: string | null;
        mediaDurationMs?: number | null;
      } = { body };
      if (attachment) {
        const uploaded = await uploadAttachment(attachment);
        messagePayload = {
          ...messagePayload,
          messageType: uploaded.messageType,
          mediaUrl: uploaded.mediaUrl,
          mediaMime: attachment.type || null,
          mediaDurationMs: null,
        };
      } else {
        messagePayload.messageType = 'text';
      }

      if (editingMessageId && body) {
        await messagesApi.editMessage(editingMessageId, body);
        setEditingMessageId(null);
      } else {
        await messagesApi.sendMessage(selectedOther.userId, messagePayload);
      }
      setDraft('');
      setAttachment(null);
      setUploadProgress(null);
      await loadThread(selectedOther.userId);
      await loadConversations();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setCanDm(false);
        setError('Follow this user to send a DM.');
      } else {
      setError((e as Error)?.message || 'Failed to send message');
      }
      setUploadProgress(null);
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
    setError(null);
    setEditingMessageId(null);
  };

  const handleTyping = async () => {
    if (!selectedOther?.userId || !typingChannelRef.current || !myId) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 1200) return;
    lastTypingSentAtRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { fromUserId: myId },
    });
    messagesApi.sendTyping(selectedOther.userId).catch(() => {});
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await messagesApi.addReaction(messageId, emoji);
      if (selectedOther?.userId) await loadThread(selectedOther.userId);
    } catch {
      setError('Failed to react to message');
    }
  };

  const handleUnsend = async (messageId: string) => {
    try {
      await messagesApi.unsendMessage(messageId);
      if (selectedOther?.userId) await loadThread(selectedOther.userId);
    } catch {
      setError('Failed to unsend message');
    }
  };

  const selectedUnread = useMemo(() => {
    if (!selectedOther) return 0;
    return conversations.find((c) => c.otherUserId === selectedOther.userId)?.unreadCount ?? 0;
  }, [conversations, selectedOther]);

  const handleFollowToDm = async () => {
    if (!selectedOther?.userId || followBusy) return;
    if (selectedOther.userId === myId) {
      setError('You cannot follow yourself.');
      return;
    }
    setFollowBusy(true);
    try {
      await usersApi.follow(selectedOther.userId);
      setCanDm(true);
      setError(null);
    } catch (e: unknown) {
      const apiMessage =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (e instanceof Error ? e.message : '');
      setError(apiMessage || 'Failed to follow user');
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6">
      <div className="grid gap-4 md:grid-cols-[280px_1fr] min-h-[60vh]">
        <Card className="md:col-span-1">
          <CardContent className="p-0">
            <div className="p-2 border-b">
              <h2 className="font-semibold text-sm">Conversations</h2>
              <Input
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-2"
              />
            </div>
            {loadingConversations ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No conversations yet. Message someone from Discover or an artist profile.</div>
            ) : (
              <ul className="divide-y">
                {conversations.map((c) => (
                  <li key={c.otherUserId}>
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-muted/50 ${selectedOther?.userId === c.otherUserId ? 'bg-muted' : ''}`}
                    >
                      {c.otherAvatarUrl ? (
                        <Image src={c.otherAvatarUrl} alt="" width={40} height={40} className="rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted shrink-0 flex items-center justify-center text-lg">👤</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.otherDisplayName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.lastMessageFromMe ? 'You: ' : ''}{c.lastMessagePreview || 'No messages'}</p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                          {c.unreadCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-[400px]">
          <CardContent className="flex flex-col flex-1 p-0 flex min-h-0">
            {!selectedOther ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
                Select a conversation or <Link href="/discover" className="text-primary underline ml-1">discover people</Link> to message.
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center gap-3">
                  <Link href={`/artist/${selectedOther.userId}`} className="flex items-center gap-3 shrink-0">
                    {selectedOther.avatarUrl ? (
                      <Image src={selectedOther.avatarUrl} alt="" width={36} height={36} className="rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">👤</div>
                    )}
                    <span className="font-medium">{selectedOther.displayName || 'Unknown'}</span>
                  </Link>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/artist/${selectedOther.userId}`}>View profile</Link>
                  </Button>
                  <div className="ml-auto text-xs text-muted-foreground">
                    {typingOther ? 'typing...' : selectedUnread > 0 ? `${selectedUnread} unread` : 'online'}
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
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {msg.unsentAt ? (
                              <p className="text-sm italic opacity-80">Message unsent</p>
                            ) : (
                              <>
                                {!!msg.body && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
                                {msg.messageType !== 'text' && msg.mediaUrl && (
                                  <>
                                    {msg.messageType === 'image' && (
                                       
                                      <img src={msg.mediaUrl} alt="" className="mt-2 max-h-52 rounded-md object-cover" />
                                    )}
                                    {msg.messageType === 'video' && (
                                      <video controls className="mt-2 max-h-56 rounded-md">
                                        <source src={msg.mediaUrl} />
                                      </video>
                                    )}
                                    {msg.messageType === 'voice' && (
                                      <audio controls className="mt-2 w-full">
                                        <source src={msg.mediaUrl} />
                                      </audio>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                            {msg.reactions?.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {msg.reactions.map((r, idx) => (
                                  <span key={`${msg.id}-${r.userId}-${r.emoji}-${idx}`} className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
                                    {r.emoji}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{formatTime(msg.createdAt)}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <button type="button" className="text-[11px] opacity-75 hover:opacity-100" onClick={() => handleReact(msg.id, '❤️')}>❤️</button>
                              <button type="button" className="text-[11px] opacity-75 hover:opacity-100" onClick={() => handleReact(msg.id, '🔥')}>🔥</button>
                              {isMe && !msg.unsentAt && msg.messageType === 'text' && (
                                <button
                                  type="button"
                                  className="text-[11px] opacity-75 hover:opacity-100"
                                  onClick={() => {
                                    setEditingMessageId(msg.id);
                                    setDraft(msg.body);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              {isMe && !msg.unsentAt && (
                                <button type="button" className="text-[11px] opacity-75 hover:opacity-100" onClick={() => handleUnsend(msg.id)}>
                                  Unsend
                                </button>
                              )}
                              {isMe && msg.status === 'read' && (
                                <span className="text-[11px] opacity-80">Seen</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                {error && <Alert variant="destructive" className="mx-4 mt-2"><AlertDescription>{error}</AlertDescription></Alert>}
                {!canDm && selectedOther?.userId !== myId && (
                  <Alert className="mx-4 mt-2">
                    <AlertDescription className="flex items-center justify-between gap-3">
                      <span>Follow this user to send a DM.</span>
                      <Button size="sm" onClick={handleFollowToDm} disabled={followBusy}>
                        {followBusy ? 'Following...' : 'Follow'}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-3 border-t space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {editingMessageId ? 'Editing message' : attachment ? `Attachment: ${attachment.name}` : ' '}
                    </div>
                    <div className="flex items-center gap-2">
                      {attachment && (
                        <Button size="sm" variant="ghost" onClick={() => setAttachment(null)}>
                          Remove file
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Attach
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*"
                        className="hidden"
                        onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  {uploadProgress != null && (
                    <div className="h-1.5 rounded bg-muted">
                      <div className="h-1.5 rounded bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  <div className="flex gap-2">
                  <Input
                    placeholder={editingMessageId ? 'Edit message...' : 'Type a message...'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onInput={handleTyping}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={(!draft.trim() && !attachment) || sending || !canDm}>
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
