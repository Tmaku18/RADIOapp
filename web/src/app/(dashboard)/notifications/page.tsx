'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

function meta(notification: Notification, ...keys: string[]): string | null {
  const data = notification.metadata;
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text && text !== 'null') return text;
  }
  return null;
}

/** In-app path the notification should open. Null when there is nowhere to go. */
function notificationHref(notification: Notification): string | null {
  const type = notification.type;
  const playId = meta(notification, 'playId', 'play_id');
  const songId = meta(notification, 'songId', 'song_id');
  const artistId = meta(notification, 'artistId', 'artist_id');
  const senderId = meta(notification, 'senderId', 'sender_id');
  const followerId = meta(notification, 'followerId', 'follower_id');
  const requestId = meta(notification, 'requestId', 'request_id');
  const storeUrl = meta(notification, 'storeUrl', 'store_url');

  switch (type) {
    case 'song_played':
      return playId ? `/artist/stats?playId=${encodeURIComponent(playId)}` : '/artist/stats';
    case 'weekly_digest':
      return '/artist/stats';
    case 'song_approved':
    case 'song_rejected':
    case 'song_status_changed':
    case 'song_liked':
      return '/artist/songs';
    case 'song_pending_review':
    case 'admin_song_status':
      return '/admin/songs';
    case 'artist_live_nudge':
      return '/go-live';
    case 'artist_live_now':
      return artistId ? `/watch/${encodeURIComponent(artistId)}` : null;
    case 'new_message':
      return senderId ? `/messages?with=${encodeURIComponent(senderId)}` : '/messages';
    case 'message_request':
      return senderId
        ? `/messages?with=${encodeURIComponent(senderId)}`
        : '/messages?tab=requests';
    case 'new_follower':
      return followerId ? `/artist/${encodeURIComponent(followerId)}` : null;
    case 'followed_artist_new_upload':
      return artistId ? `/artist/${encodeURIComponent(artistId)}` : '/listen';
    case 'feed_post_liked':
      return '/social';
    case 'content_liked':
      return '/pro-networx/me';
    case 'job_application':
      return requestId
        ? `/job-board?request=${encodeURIComponent(requestId)}`
        : '/job-board';
    case 'refinery_new_review':
      return songId ? `/refinery/analytics/${encodeURIComponent(songId)}` : '/refinery';
    case 'refinery_submission_received':
      return '/refinery';
    case 'app_update':
      return storeUrl;
    case 'up_next':
    case 'live_now':
    case 'song_up_next':
    case 'song_up_next_5min':
    case 'song_live_now':
    case 'artist_song_on_radio':
    case 'artist_song_first_play':
    case 'followed_artist_up_next':
    case 'followed_artist_up_next_5min':
      return '/listen';
    default:
      return null;
  }
}
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'song_approved':
      return '✅';
    case 'song_rejected':
      return '❌';
    case 'song_liked':
      return '❤️';
    case 'song_played':
      return '🎵';
    case 'artist_song_on_radio':
      return '📻';
    default:
      return '🔔';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    try {
      setLoading(true);
      setError(null);
      const response = await notificationsApi.getAll();
      if (requestId !== loadRequestRef.current) return;
      const list = response?.data?.notifications;
      setNotifications(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      if (requestId !== loadRequestRef.current) return;
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj.response?.data?.message ?? errObj.message ?? 'Failed to load notifications';
      setError(msg);
      setNotifications([]);
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.uid) {
      void loadNotifications();
    }
  }, [authLoading, user?.uid, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      window.dispatchEvent(new CustomEvent('notifications-changed'));
    } catch (err: unknown) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      window.dispatchEvent(new CustomEvent('notifications-changed'));
    } catch (err: unknown) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || clearing) return;
    const confirmed = window.confirm('Clear all notifications? This cannot be undone.');
    if (!confirmed) return;

    const previous = notifications;
    loadRequestRef.current += 1;
    setClearing(true);
    setNotifications([]);
    setError(null);
    window.dispatchEvent(new CustomEvent('notifications-cleared'));

    try {
      await notificationsApi.deleteAll();
    } catch (err: unknown) {
      console.error('Failed to clear notifications:', err);
      setNotifications(previous);
      setError('Failed to clear notifications. Please try again.');
      window.dispatchEvent(new CustomEvent('notifications-changed'));
    } finally {
      setClearing(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : "You're all caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={notifications.length === 0 || clearing}
          >
            {clearing ? 'Clearing...' : 'Clear notifications'}
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No notifications yet</h3>
            <p className="text-muted-foreground">We&apos;ll notify you when something important happens.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {notifications.map((notification) => {
              const href = notificationHref(notification);
              return (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.read) void handleMarkAsRead(notification.id);
                    if (!href) return;
                    if (href.startsWith('http')) {
                      window.location.assign(href);
                      return;
                    }
                    router.push(href);
                  }}
                  className={`p-4 transition-colors ${href ? 'cursor-pointer' : ''} ${notification.read ? 'bg-card' : 'bg-primary/5 hover:bg-primary/10'}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">
                          {notification.title}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">{formatTimeAgo(notification.createdAt)}</span>
                      </div>
                      {notification.message && (
                        <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                      )}
                      {notification.type === 'song_rejected' && (
                        <div className="mt-2 text-sm">
                          <a
                            href={SUPPORT_DISCORD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Contact Support (Discord)
                          </a>
                          <span className="text-muted-foreground mx-2">•</span>
                          <span className="text-muted-foreground">48 hours to appeal</span>
                        </div>
                      )}
                      {!notification.read && (
                        <div className="mt-2">
                          <Badge variant="secondary">New</Badge>
                        </div>
                      )}
                    </div>
                    {href ? (
                      <span className="text-muted-foreground" aria-hidden>›</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
