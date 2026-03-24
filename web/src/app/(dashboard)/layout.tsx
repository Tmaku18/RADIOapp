'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from '@/lib/api';
import { hasArtistCapability } from '@/lib/roles';
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
import { BottomNav } from '@/components/dashboard/BottomNav';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ComputerSettingsIcon,
  Sun01Icon,
  DarkModeIcon,
  ComputerIcon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';

const PRO_NETWORX_EXTERNAL_URL =
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL ||
  'https://www.discovermeradio.com/pro-networx/directory';
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';
type MainNavItem = { name: string; href: string; icon: string; external?: boolean };

const listenerNavigation: MainNavItem[] = [
  { name: 'Radio', href: '/listen', icon: '🎵' },
  { name: 'Social', href: '/social', icon: '📱' },
  { name: 'Vote', href: '/competition', icon: '📢' },
  { name: 'The Refinery', href: '/refinery', icon: '🔬' },
  { name: 'Rewards', href: '/yield', icon: '⛏️' },
];

const artistNavigation: MainNavItem[] = [
  { name: 'Radio', href: '/listen', icon: '🎵' },
  { name: 'Social', href: '/social', icon: '📱' },
  { name: 'Studio', href: '/artist/songs', icon: '🎙️' },
  { name: 'Analytics', href: '/artist/stats', icon: '📈' },
  { name: 'Pro-Networx', href: PRO_NETWORX_EXTERNAL_URL, icon: '💼', external: true },
  { name: 'Rewards', href: '/yield', icon: '⛏️' },
];

const moreNav = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Profile', href: '/profile', icon: '👤' },
  { name: 'Live', href: '/live', icon: '🔴' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];
const streamerNav = { name: 'Stream settings', href: '/stream-settings', icon: '📡' };

const DASHBOARD_LOGO_PRIMARY = '/networx-logo.png';
const DASHBOARD_LOGO_FALLBACK = '/icons/icon.svg';

function DashboardSidebarLogo() {
  const [useFallback, setUseFallback] = useState(false);
  return (
    <span className="size-10 shrink-0 flex items-center justify-center rounded-lg bg-primary/20 overflow-hidden">
      {useFallback ? (
        <Image
          src={DASHBOARD_LOGO_FALLBACK}
          alt=""
          width={40}
          height={40}
          className="size-10 object-contain"
          priority
          unoptimized
        />
      ) : (
        <Image
          src={DASHBOARD_LOGO_PRIMARY}
          alt=""
          width={140}
          height={50}
          className="h-10 w-auto object-contain object-left"
          priority
          unoptimized
          onError={() => setUseFallback(true)}
        />
      )}
    </span>
  );
}

const adminSubNavigation = [
  { name: 'Songs', href: '/admin/songs', icon: '🎶' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
  { name: 'Swipe', href: '/admin/swipe', icon: '🃏' },
  { name: 'Queue', href: '/admin/queue', icon: '🧵' },
  { name: 'Streamers', href: '/admin/streamers', icon: '📡' },
  { name: 'Feed', href: '/admin/feed', icon: '📱' },
  { name: 'Fallback', href: '/admin/fallback', icon: '📻' },
  { name: 'Free Rotation', href: '/admin/free-rotation', icon: '🔄' },
  { name: 'Listen', href: '/listen', icon: '🎵' },
];

// Flattened nav for page title lookup
function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/songs')) return 'Songs';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/swipe')) return 'Swipe';
  if (pathname.startsWith('/admin/queue')) return 'Queue';
  if (pathname.startsWith('/admin/streamers')) return 'Streamers';
  if (pathname.startsWith('/admin/feed')) return 'Feed';
  if (pathname.startsWith('/admin/fallback')) return 'Fallback';
  if (pathname.startsWith('/admin/free-rotation')) return 'Free Rotation';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/browse')) return 'Discover';
  if (pathname.startsWith('/discover')) return 'Discover';
  if (pathname.startsWith('/social')) return 'Social';
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/listen')) return 'Radio';
  if (pathname.startsWith('/yield')) return 'Rewards';
  if (pathname.startsWith('/refinery')) return 'The Refinery';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/live')) return 'Live';
  if (pathname.startsWith('/stream-settings')) return 'Stream settings';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname === '/artist' || pathname.startsWith('/artist/songs')) return 'My Songs';
  if (pathname.startsWith('/artist/upload')) return 'Upload';
  if (pathname.startsWith('/artist/credits')) return 'Credits';
  if (pathname.startsWith('/artist/stats')) return 'Analytics';
  if (pathname.startsWith('/artist/live-services')) return 'Live services';
  if (pathname.startsWith('/artist/services')) return 'Pro-Networx';
  if (pathname.startsWith('/browse/saved')) return 'Saved';
  if (pathname.startsWith('/competition')) return 'Vote';
  if (pathname.startsWith('/job-board')) return 'Pro-Networx';
  if (pathname.startsWith('/apply')) return 'Apply for Artist';
  if (pathname.match(/^\/artist\/[^/]+$/)) return 'Artist';
  return 'Dashboard';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isListenPage = pathname.startsWith('/listen');
  const router = useRouter();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const isArtistMode = hasArtistCapability(profile?.role);
  const brandMode: 'listener' | 'artist' = isArtistMode ? 'artist' : 'listener';

  // Refetch profile when dashboard loads so role changes (e.g. admin grant) appear without sign-out
  const hasRefetched = React.useRef(false);
  useEffect(() => {
    if (user && !loading && !hasRefetched.current) {
      hasRefetched.current = true;
      refreshProfile();
    }
  }, [user, loading, refreshProfile]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [loading, user, router, pathname]);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme } = useTheme();

  // Set role cookie for middleware (auth guard on /artist/* and /job-board)
  useEffect(() => {
    if (typeof document === 'undefined' || !profile?.role) return;
    const role = profile.role.toLowerCase();
    document.cookie = `user_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }, [profile?.role]);

  useEffect(() => {
    if (user && profile) {
      const fetchUnreadCount = async () => {
        try {
          const response = await notificationsApi.getUnreadCount();
          const count = response?.data?.count;
          setUnreadCount(typeof count === 'number' ? count : 0);
        } catch {
          setUnreadCount(0);
        }
      };
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user, profile]);

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

  const isAdminPath = pathname.startsWith('/admin');

  return (
    <div data-brand={brandMode} className="min-h-screen">
      <SidebarProvider>
        <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard" className="flex items-center gap-3">
                  <DashboardSidebarLogo />
                  <span className="font-bold text-foreground">Networx</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {(isArtistMode ? artistNavigation : listenerNavigation).map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.name}>
                    {item.external ? (
                      <SidebarMenuButton asChild isActive={false}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center"
                        >
                          <span className="chrome-icon mr-3 text-sm">{item.icon}</span>
                          <span>{item.name}</span>
                        </a>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href} className="flex items-center">
                          <span className="chrome-icon mr-3 text-sm">{item.icon}</span>
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}

              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <span className="chrome-icon mr-3 text-sm">⋯</span>
                      <span>More</span>
                      <HugeiconsIcon
                        icon={ArrowUp01Icon}
                        strokeWidth={2}
                        className="ml-auto size-4 group-data-[state=closed]/collapsible:rotate-180"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {moreNav.map((item) => (
                        <SidebarMenuSubItem key={item.name}>
                          <SidebarMenuSubButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                            <Link href={item.href}>{item.name}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      {hasArtistCapability(profile?.role) && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={pathname.startsWith(streamerNav.href)}>
                            <Link href={streamerNav.href}>{streamerNav.name}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      {hasArtistCapability(profile?.role) && (
                        <>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith('/artist/songs')}>
                              <Link href="/artist/songs">My Songs</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith('/artist/upload')}>
                              <Link href="/artist/upload">Upload</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith('/artist/credits')}>
                              <Link href="/artist/credits">Credits</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={pathname.startsWith('/artist/live-services')}>
                              <Link href="/artist/live-services">Live services</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          {profile?.id && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={
                                  profile.role === 'service_provider'
                                    ? pathname.startsWith(`/pro-networx/u/${profile.id}`)
                                    : pathname.startsWith(`/artist/${profile.id}`)
                                }
                              >
                                <Link
                                  href={
                                    profile.role === 'service_provider'
                                      ? `/pro-networx/u/${profile.id}`
                                      : `/artist/${profile.id}`
                                  }
                                >
                                  View public profile
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {profile?.role === 'admin' && (
                <Collapsible defaultOpen={isAdminPath} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <span className="chrome-icon mr-3 text-sm">⚙️</span>
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

        <SidebarFooter className="pb-20 md:pb-2">
          <div className="p-2">
            <p className="text-sm text-foreground truncate px-2">{profile?.displayName || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize px-2">{profile?.role || 'Loading...'}</p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a
                  href={SUPPORT_DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="chrome-icon mr-3 text-xs">🛟</span>
                  <span>Support</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} disabled={isSigningOut}>
                <span className="chrome-icon mr-3 text-xs">{isSigningOut ? '⏳' : '🚪'}</span>
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
            {getPageTitle(pathname)}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild className="amplify-btn hover:opacity-90">
              <Link href={isArtistMode ? '/artist/upload' : '/competition'}>
                {isArtistMode ? 'Upload' : 'Amplify'}
              </Link>
            </Button>

            <Button variant="outline" size="icon" asChild>
              <Link href="/notifications" className="relative">
                <span className="chrome-icon text-sm">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="chrome-icon-button">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={SUPPORT_DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="chrome-icon mr-2 text-xs">🛟</span>
                    Support
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                  <span className="chrome-icon mr-2 text-xs">{isSigningOut ? '⏳' : '🚪'}</span>
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div
          className={`flex-1 min-h-0 bg-muted/30 flex flex-col ${
            isListenPage
              ? 'overflow-hidden p-0 pb-0'
              : 'overflow-auto p-4 sm:p-6 md:p-8 pb-24'
          }`}
        >
          {children}
        </div>
        {!isListenPage && <BottomNav />}
      </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
