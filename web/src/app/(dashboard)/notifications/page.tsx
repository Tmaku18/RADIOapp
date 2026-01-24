'use client';

import { useState, useEffect } from 'react';
import { notificationsApi } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  metadata?: {
    songId?: string;
    songTitle?: string;
    reason?: string;
  };
  read: boolean;
  createdAt: string;
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'song_approved':
      return '✅';
    case 'song_rejected':
      return '❌';
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.getAll();
      setNotifications(response.data.notifications);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (err: any) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err: any) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You\'re all caught up!'
            }
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
          <p className="text-gray-600">
            We'll notify you when something important happens.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.read && handleMarkAsRead(notification.id)}
              className={`p-4 cursor-pointer transition-colors ${
                notification.read
                  ? 'bg-white'
                  : 'bg-purple-50 hover:bg-purple-100'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="text-2xl">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${notification.read ? 'text-gray-900' : 'text-purple-900'}`}>
                      {notification.title}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  {notification.message && (
                    <p className="mt-1 text-sm text-gray-600">
                      {notification.message}
                    </p>
                  )}
                  {notification.type === 'song_rejected' && (
                    <div className="mt-2 text-sm">
                      <a
                        href="mailto:support@radioapp.com"
                        className="text-purple-600 hover:text-purple-800"
                      >
                        Contact Support
                      </a>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="text-gray-500">48 hours to appeal</span>
                    </div>
                  )}
                  {!notification.read && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        New
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
