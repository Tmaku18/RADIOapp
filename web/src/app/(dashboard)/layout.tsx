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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  // Show role selection modal if user has Firebase auth but no Supabase profile
  if (pendingGoogleUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <RoleSelectionModal
          onSelect={handleRoleSelect}
          onCancel={cancelGoogleSignUp}
          loading={isCompletingSignUp}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🎧</span>
            <span className="text-xl font-bold text-foreground">RadioApp</span>
          </Link>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Button
                  key={item.name}
                  variant={isActive ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={item.href} className="flex items-center">
                    <span className="mr-3 text-lg">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="mb-3">
            <p className="text-sm text-foreground truncate">{profile?.displayName || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'Loading...'}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <span className="mr-3">{isSigningOut ? '⏳' : '🚪'}</span>
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex flex-col h-screen">
        <header className="h-16 shrink-0 bg-card border-b border-border flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-foreground">
            {navigation.find(n => pathname.startsWith(n.href))?.name || 'Dashboard'}
          </h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link href="/notifications" className="relative">
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
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

        <div className="flex-1 min-h-0 overflow-auto p-8 bg-muted/50 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
