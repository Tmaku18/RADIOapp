'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from '@/lib/api';
import { RoleSelectionModal } from '@/components/auth/RoleSelectionModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ComputerSettingsIcon, Sun01Icon, DarkModeIcon, ComputerIcon } from '@hugeicons/core-free-icons';

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
  { name: 'Fallback', href: '/admin/fallback', icon: '📻' },
  { name: 'Free Rotation', href: '/admin/free-rotation', icon: '🔄' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut, pendingGoogleUser, completeGoogleSignUp, cancelGoogleSignUp } = useAuth();
  const [isCompletingSignUp, setIsCompletingSignUp] = useState(false);

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
  const { theme, setTheme } = useTheme();

  // Fetch unread notification count - only when user has a profile
  useEffect(() => {
    if (user && profile) {
      const fetchUnreadCount = async () => {
        try {
          const response = await notificationsApi.getUnreadCount();
          setUnreadCount(response.data.count);
        } catch {
          setUnreadCount(0);
        }
      };
      fetchUnreadCount();
      // Refresh every 60 seconds
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  // Handle role selection for pending Google users
  const handleRoleSelect = async (role: 'listener' | 'artist') => {
    setIsCompletingSignUp(true);
    try {
      await completeGoogleSignUp(role);
    } catch (error) {
      console.error('Failed to complete sign up:', error);
    } finally {
      setIsCompletingSignUp(false);
    }
  };

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

  // Show role selection modal if user has Firebase auth but no Supabase profile
  if (pendingGoogleUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <RoleSelectionModal
          onSelect={handleRoleSelect}
          onCancel={cancelGoogleSignUp}
          loading={isCompletingSignUp}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 dark:bg-gray-950 text-white border-r border-gray-800 dark:border-gray-900">
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
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {navigation.find(n => pathname.startsWith(n.href))?.name || 'Dashboard'}
          </h1>
          
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <Link
              href="/notifications"
              className="relative p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Settings - Theme switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-gray-300 dark:border-gray-700"
                >
                  <HugeiconsIcon icon={ComputerSettingsIcon} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <HugeiconsIcon icon={Sun01Icon} strokeWidth={2} className="mr-2" />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <HugeiconsIcon icon={DarkModeIcon} strokeWidth={2} className="mr-2" />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} className="mr-2" />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <div className="p-8 bg-gray-100 dark:bg-gray-950">
          {children}
        </div>
      </main>
    </div>
  );
}
