'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { chatApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatMessage {
  id: string;
  userId: string;
  songId: string | null;
  displayName: string;
  avatarUrl: string | null;
  message: string;
  createdAt: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const TWITCH_LIKE_NAME_COLORS = [
  '#00F5FF',
  '#CCFF00',
  '#F472B6',
  '#60A5FA',
  '#F59E0B',
  '#A78BFA',
  '#34D399',
  '#FB7185',
];

function usernameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return TWITCH_LIKE_NAME_COLORS[Math.abs(hash) % TWITCH_LIKE_NAME_COLORS.length];
}

function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const msg of current) byId.set(msg.id, msg);
  for (const msg of incoming) byId.set(msg.id, msg);
  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(-100);
}

export default function ChatSidebar() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [transparentMode, setTransparentMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setupChannelRef = useRef<(() => void) | null>(null);
  const connectionStatusRef = useRef<ConnectionStatus>(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('networx_chat_transparent');
    if (saved === '0') setTransparentMode(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'networx_chat_transparent',
      transparentMode ? '1' : '0',
    );
  }, [transparentMode]);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history and status (shared for initial load and Retry)
  const loadHistory = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const [historyRes, statusRes] = await Promise.all([
        chatApi.getHistory({ limit: 50 }),
        chatApi.getStatus(),
      ]);
      setMessages(historyRes.data.messages || []);
      setChatEnabled(statusRes.data.enabled ?? true);
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = axErr?.response?.status;
      const serverMsg = axErr?.response?.data?.message;
      const isNetwork = status === undefined || status === 0;
      const message = serverMsg
        ? serverMsg
        : isNetwork
          ? "Can't reach chat server. Check that the app backend is running and try again."
          : 'Chat is temporarily unavailable.';
      console.warn('Chat load failed:', status, (err as Error)?.message || err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);

  // Polling fallback: keeps chat fresh when Realtime is flaky/backgrounded.
  useEffect(() => {
    if (!user) return;
    let stopped = false;

    const poll = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const [historyRes, statusRes] = await Promise.all([
          chatApi.getHistory({ limit: 50 }),
          chatApi.getStatus(),
        ]);
        const fetched = (historyRes.data.messages || []) as ChatMessage[];
        setMessages((prev) => mergeMessages(prev, fetched));
        setChatEnabled(statusRes.data.enabled ?? true);
      } catch {
        // Silent fallback: realtime may still be working.
      }
    };

    // Keep UI fresh for users even without manual refresh.
    const interval = setInterval(poll, 3000);
    void poll();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [user]);

  // Subscribe to Supabase Realtime for new messages
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials missing, chat realtime disabled');
      setConnectionStatus('error');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    let connectionTimeoutId: NodeJS.Timeout | null = null;
    let hasConnected = false;

    const scheduleReconnect = (delayMs: number) => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        console.log('Attempting to reconnect chat...');
        setupChannel();
      }, delayMs);
    };
    
    const setupChannel = () => {
      // Clean up existing channel if any
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      hasConnected = false;
      setConnectionStatus('connecting');
      
      // Set a timeout - if we don't get SUBSCRIBED within 10s, assume connected
      // (some Supabase configurations don't fire the callback reliably)
      connectionTimeoutId = setTimeout(() => {
        if (!hasConnected) {
          console.log('Chat connection timeout - assuming connected');
          hasConnected = true;
          setConnectionStatus('connected');
        }
      }, 10000);
      
      const channel = supabase
        .channel('radio-chat')
        .on('broadcast', { event: 'new_message' }, (payload) => {
          const newMsg = payload.payload as ChatMessage;
          setMessages((prev) => mergeMessages(prev, [newMsg]));
          // If we receive a message, we're definitely connected
          if (!hasConnected) {
            hasConnected = true;
            setConnectionStatus('connected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
          }
        })
        .on('broadcast', { event: 'message_deleted' }, (payload) => {
          const { messageId } = payload.payload as { messageId: string };
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        })
        .subscribe((status) => {
          console.log('Chat channel status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Chat channel connected');
            hasConnected = true;
            setConnectionStatus('connected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Chat channel error');
            setConnectionStatus('error');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            scheduleReconnect(5000);
          } else if (status === 'TIMED_OUT') {
            console.warn('Chat channel timed out');
            setConnectionStatus('disconnected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            scheduleReconnect(3000);
          } else if (status === 'CLOSED') {
            console.log('Chat channel closed');
            setConnectionStatus('disconnected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            scheduleReconnect(3000);
          }
        });
      
      channelRef.current = channel;
    };

    setupChannelRef.current = setupChannel;
    setupChannel();

    // Reconnect when tab becomes visible again (browser often drops Realtime when backgrounded)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const s = connectionStatusRef.current;
        if (s === 'disconnected' || s === 'error') {
          setConnectionStatus('connecting');
          setupChannel();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
      }
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending || !chatEnabled) return;

    const text = newMessage.trim();
    setIsSending(true);
    setError(null);

    try {
      const res = await chatApi.sendMessage(text);
      const id = (res.data as { id?: string })?.id;
      setNewMessage('');
      inputRef.current?.focus();
      // Optimistic update: show sent message immediately (Realtime may be slow or fail)
      if (id && profile) {
        const optimistic: ChatMessage = {
          id,
          userId: profile.id,
          songId: null,
          displayName: profile.displayName || 'You',
          avatarUrl: profile.avatarUrl ?? null,
          message: text,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => mergeMessages(prev, [optimistic]));
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { status?: number; data?: { message?: string } } };
      const serverMsg = errObj?.response?.data?.message;
      const status = errObj?.response?.status;
      const isNetwork = status === undefined || status === 0;
      const errorMessage = serverMsg
        ? serverMsg
        : isNetwork
          ? "Can't reach chat server. Check that the backend is running."
          : 'Failed to send message';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="w-80 bg-card border-l border-border flex items-center justify-center text-muted-foreground">
        Log in to join the chat
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <Button
        onClick={() => setIsCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 rounded-l-lg"
      >
        <span className="text-lg">💬</span>
        {messages.length > 0 && (
          <span className="block text-xs mt-1">{messages.length}</span>
        )}
      </Button>
    );
  }

  return (
    <div
      className={`w-full border-l border-white/10 flex flex-col h-full ${
        transparentMode
          ? 'bg-black/25 backdrop-blur-sm'
          : 'bg-card/90 backdrop-blur-md'
      }`}
    >
      {/* Header */}
      <div
        className={`px-3 py-2 border-b border-white/10 flex items-center justify-between ${
          transparentMode ? 'bg-black/15' : 'bg-card/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Live Chat</h2>
            <p className="text-[11px] text-muted-foreground">Collective channel</p>
          </div>
          {/* Connection status indicator */}
          {connectionStatus === 'connected' && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Connected"></span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Connecting..."></span>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <span className="w-2 h-2 bg-muted-foreground rounded-full" title="Disconnected"></span>
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setupChannelRef.current?.()}>
                Reconnect
              </Button>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <span className="w-2 h-2 bg-destructive rounded-full" title="Connection error"></span>
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setupChannelRef.current?.()}>
                Retry
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTransparentMode((prev) => !prev)}
            className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 hover:text-foreground hover:border-white/40 transition-colors"
            title="Toggle transparent mode"
          >
            {transparentMode ? 'Solid' : 'Glass'}
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1.5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet</p>
            <p className="text-sm mt-1">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-md px-2 py-1 transition-colors ${
                transparentMode
                  ? 'bg-black/15 hover:bg-black/25'
                  : 'bg-black/10 hover:bg-black/20'
              }`}
            >
              <div className="flex items-start gap-2">
                <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                  <AvatarImage src={msg.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {msg.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[13px] leading-[1.2rem] break-words text-foreground/95">
                  <span className="text-[11px] opacity-55 mr-1">
                    {formatTime(msg.createdAt)}
                  </span>
                  <span
                    className="font-semibold mr-1"
                    style={{ color: usernameColor(msg.displayName) }}
                  >
                    {msg.displayName}
                  </span>
                  {msg.userId === profile?.id && (
                    <span className="inline-flex items-center rounded-sm border border-primary/50 bg-primary/15 text-[9px] uppercase tracking-wide font-semibold px-1 mr-1 text-primary">
                      You
                    </span>
                  )}
                  {connectionStatus === 'connected' && msg.userId !== profile?.id && (
                    <span className="inline-flex items-center rounded-sm border border-white/25 bg-white/10 text-[9px] uppercase tracking-wide font-semibold px-1 mr-1 text-foreground/80">
                      Live
                    </span>
                  )}
                  <span className={msg.userId === profile?.id ? 'text-white' : 'text-foreground/90'}>
                    {msg.message}
                  </span>
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {error && (
        <div className="mx-4 mb-2 space-y-2">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={isLoading}>
              {isLoading ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className={`p-3 border-t border-white/10 ${
          transparentMode ? 'bg-black/20' : 'bg-card/70'
        }`}
      >
        {!chatEnabled ? (
          <div className="text-center text-muted-foreground text-sm py-2">
            Chat is currently disabled
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Send a message..."
              maxLength={280}
              disabled={isSending}
              className={`flex-1 border-white/15 text-foreground placeholder:text-foreground/50 ${
                transparentMode ? 'bg-black/40' : 'bg-background/80'
              }`}
            />
            <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
              {isSending ? '...' : '→'}
            </Button>
          </div>
        )}
        <div className="text-right text-xs text-muted-foreground mt-1">
          {newMessage.length}/280
        </div>
      </form>
    </div>
  );
}
