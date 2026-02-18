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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setupChannelRef = useRef<(() => void) | null>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load initial chat history (Hydration Pattern)
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const [historyRes, statusRes] = await Promise.all([
          chatApi.getHistory({ limit: 50 }),
          chatApi.getStatus(),
        ]);
        setMessages(historyRes.data.messages || []);
        setChatEnabled(statusRes.data.enabled);
      } catch (err: unknown) {
        console.error('Failed to load chat history:', err);
        setError('Failed to load chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadHistory();
    }
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
    
    const setupChannel = () => {
      // Clean up existing channel if any
      if (channelRef.current) {
        channelRef.current.unsubscribe();
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
          setMessages((prev) => [...prev.slice(-99), newMsg]); // Keep last 100 messages
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
            // Clear timeouts
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
            // Attempt reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect chat...');
              setupChannel();
            }, 5000);
          } else if (status === 'TIMED_OUT') {
            console.warn('Chat channel timed out');
            setConnectionStatus('disconnected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            // Attempt reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect chat...');
              setupChannel();
            }, 3000);
          } else if (status === 'CLOSED') {
            console.log('Chat channel closed');
            setConnectionStatus('disconnected');
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
            // Attempt reconnect after 3 seconds (same as TIMED_OUT)
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect chat after close...');
              setupChannel();
            }, 3000);
          }
        });
      
      channelRef.current = channel;
    };

    setupChannelRef.current = setupChannel;
    setupChannel();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (connectionTimeoutId) {
        clearTimeout(connectionTimeoutId);
      }
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending || !chatEnabled) return;

    setIsSending(true);
    setError(null);

    try {
      await chatApi.sendMessage(newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const errorMessage = errObj?.response?.data?.message || 'Failed to send message';
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
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
    <div className="w-80 bg-card/80 border-l border-border backdrop-blur flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <div>
            <h2 className="font-semibold text-foreground">The Room</h2>
            <p className="text-xs text-muted-foreground">Live chat with the collective</p>
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
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
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
              className={`flex gap-2 ${
                msg.userId === profile?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={msg.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">{msg.displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>

              {/* Message: dark grey bubble, thin left border (Cyan for listener); Signal dot for active */}
              <div
                className={`chat-bubble max-w-[200px] rounded-lg px-3 py-2 transition-colors ${
                  msg.userId === profile?.id
                    ? 'border-primary/50 text-foreground signal-glow'
                    : 'text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {connectionStatus === 'connected' && (
                    <span className="chat-signal-dot active" title="Active listener" aria-hidden />
                  )}
                  <span className="text-xs font-medium opacity-75">
                    {msg.displayName}
                  </span>
                  <span className="text-xs opacity-50">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm break-words">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {error && (
        <div className="mx-4 mb-2">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
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
              placeholder="Type a message..."
              maxLength={280}
              disabled={isSending}
              className="flex-1"
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
