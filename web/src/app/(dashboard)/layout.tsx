'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from '@/lib/api';

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Listen', href: '/listen', icon: '🎵' },
  { name: 'Profile', href: '/profile', icon: '👤' },
];

const artistNavigation = [
  { name: 'My Songs', href: '/artist/songs', icon: '🎵' },
  { name: 'Upload', href: '/artist/upload', icon: '📤' },
  { name: 'Credits', href: '/artist/credits', icon: '💰' },
  { name: 'Stats', href: '/artist/stats', icon: '📈' },
];

const adminNavigation = [
  { name: 'Admin', href: '/admin', icon: '⚙️' },
  { name: 'Songs', href: '/admin/songs', icon: '🎶' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [loading, user, router, pathname]);

  // Build navigation based on role
  const navigation = [
    ...baseNavigation,
    ...(profile?.role === 'artist' || profile?.role === 'admin' ? artistNavigation : []),
    ...(profile?.role === 'admin' ? adminNavigation : []),
  ];

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (user) {
      const fetchUnreadCount = async () => {
        try {
          const response = await notificationsApi.getUnreadCount();
          setUnreadCount(response.data.count);
        } catch (error) {
          console.error('Failed to fetch notification count:', error);
        }
      };
      fetchUnreadCount();
      // Refresh every 60 seconds
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 text-white">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🎧</span>
            <span className="text-xl font-bold">RadioApp</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info & Sign out */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="mb-3">
            <p className="text-sm text-white truncate">
              {profile?.displayName || user.email}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {profile?.role || 'Loading...'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className={`w-full flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${
              isSigningOut 
                ? 'text-gray-500 cursor-not-allowed' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="mr-3">{isSigningOut ? '⏳' : '🚪'}</span>
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {navigation.find(n => pathname.startsWith(n.href))?.name || 'Dashboard'}
          </h1>
          
          {/* Notification Bell */}
          <Link
            href="/notifications"
            className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
