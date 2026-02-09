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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ComputerSettingsIcon,
  Sun01Icon,
  DarkModeIcon,
  ComputerIcon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';

const baseNavigation = [
  { name: 'Browse', href: '/browse', icon: '🔍' },
  { name: 'Discover', href: '/discover', icon: '✨' },
  { name: 'Radio', href: '/listen', icon: '🎵' },
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Profile', href: '/profile', icon: '👤' },
  { name: 'Messages', href: '/messages', icon: '💬' },
  { name: 'Job board', href: '/job-board', icon: '📋' },
];

const artistNavigation = [
  { name: 'My Songs', href: '/artist/songs', icon: '🎵' },
  { name: 'Upload', href: '/artist/upload', icon: '📤' },
  { name: 'Live services', href: '/artist/live-services', icon: '📅' },
  { name: 'Services', href: '/artist/services', icon: '🛠️' },
  { name: 'Credits', href: '/artist/credits', icon: '💰' },
  { name: 'Stats', href: '/artist/stats', icon: '📈' },
];

const adminSubNavigation = [
  { name: 'Songs', href: '/admin/songs', icon: '🎶' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
  { name: 'Feed', href: '/admin/feed', icon: '📱' },
  { name: 'Fallback', href: '/admin/fallback', icon: '📻' },
  { name: 'Free Rotation', href: '/admin/free-rotation', icon: '🔄' },
];

// Flattened nav for page title lookup
function getPageTitle(pathname: string, profileRole?: string): string {
  if (pathname.startsWith('/admin/songs')) return 'Songs';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/feed')) return 'Feed';
  if (pathname.startsWith('/admin/fallback')) return 'Fallback';
  if (pathname.startsWith('/admin/free-rotation')) return 'Free Rotation';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/browse')) return 'Browse';
  if (pathname.startsWith('/discover')) return 'Discover';
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/listen')) return 'Radio';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/artist/songs')) return 'My Songs';
  if (pathname.startsWith('/artist/upload')) return 'Upload';
  if (pathname.startsWith('/artist/credits')) return 'Credits';
  if (pathname.startsWith('/artist/stats')) return 'Stats';
  if (pathname.startsWith('/artist/live-services')) return 'Live services';
  if (pathname.startsWith('/artist/services')) return 'Services';
  if (pathname.startsWith('/browse/saved')) return 'Saved';
  if (pathname.startsWith('/competition')) return 'Competition';
  if (pathname.startsWith('/job-board')) return 'Job board';
  if (pathname.match(/^\/artist\/[^/]+$/)) return 'Artist';
  return 'Dashboard';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut, pendingGoogleUser, completeGoogleSignUp, cancelGoogleSignUp } = useAuth();
  const [isCompletingSignUp, setIsCompletingSignUp] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [loading, user, router, pathname]);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme } = useTheme();

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
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const handleRoleSelect = async (role: 'listener' | 'artist' | 'service_provider') => {
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
    return null;
  }

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

  const isAdminPath = pathname.startsWith('/admin');

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/browse" className="flex items-center gap-2">
                  <span className="text-2xl">🎧</span>
                  <span className="font-bold text-foreground">Discover Me</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {baseNavigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href} className="flex items-center">
                        <span className="mr-3 text-lg">{item.icon}</span>
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {(profile?.role === 'artist' || profile?.role === 'admin') &&
                artistNavigation.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href} className="flex items-center">
                          <span className="mr-3 text-lg">{item.icon}</span>
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

              {profile?.role === 'admin' && (
                <Collapsible defaultOpen={isAdminPath} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <span className="mr-3 text-lg">⚙️</span>
                        <span>Admin</span>
                        <HugeiconsIcon
                          icon={ArrowUp01Icon}
                          strokeWidth={2}
                          className="ml-auto size-4 group-data-[state=closed]/collapsible:rotate-180"
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname === '/admin'}>
                            <Link href="/admin">Overview</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {adminSubNavigation.map((item) => (
                          <SidebarMenuSubItem key={item.name}>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith(item.href)}>
                              <Link href={item.href}>{item.name}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="p-2">
            <p className="text-sm text-foreground truncate px-2">{profile?.displayName || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize px-2">{profile?.role || 'Loading...'}</p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} disabled={isSigningOut}>
                <span className="mr-3">{isSigningOut ? '⏳' : '🚪'}</span>
                <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 md:px-8 bg-card">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-xl font-semibold text-foreground">
            {getPageTitle(pathname, profile?.role)}
          </h1>

          <div className="ml-auto flex items-center gap-2">
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

        <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 md:p-8 bg-muted/30 flex flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
