'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { chatApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
      } catch (err: any) {
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
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to send message';
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
      <div className="w-80 bg-gray-900 border-l border-gray-800 flex items-center justify-center text-gray-400">
        Log in to join the chat
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-purple-600 text-white px-2 py-4 rounded-l-lg shadow-lg hover:bg-purple-700 transition-colors"
      >
        <span className="text-lg">💬</span>
        {messages.length > 0 && (
          <span className="block text-xs mt-1">{messages.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="font-semibold text-white">Live Chat</h2>
          {/* Connection status indicator */}
          {connectionStatus === 'connected' && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Connected"></span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Connecting..."></span>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <span className="w-2 h-2 bg-gray-500 rounded-full" title="Disconnected"></span>
              <button
                onClick={() => setupChannelRef.current?.()}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Reconnect
              </button>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full" title="Connection error"></span>
              <button
                onClick={() => setupChannelRef.current?.()}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Retry
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
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
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                {msg.avatarUrl ? (
                  <img
                    src={msg.avatarUrl}
                    alt={msg.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  msg.displayName.charAt(0).toUpperCase()
                )}
              </div>

              {/* Message */}
              <div
                className={`max-w-[200px] ${
                  msg.userId === profile?.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                } rounded-lg px-3 py-2`}
              >
                <div className="flex items-center gap-2 mb-1">
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

      {/* Error Toast */}
      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
        {!chatEnabled ? (
          <div className="text-center text-gray-500 text-sm py-2">
            Chat is currently disabled
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              maxLength={280}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? '...' : '→'}
            </button>
          </div>
        )}
        <div className="text-right text-xs text-gray-500 mt-1">
          {newMessage.length}/280
        </div>
      </form>
    </div>
  );
}
