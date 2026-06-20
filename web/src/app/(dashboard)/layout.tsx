'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { GenreOnboardingDialog } from '@/components/onboarding/GenreOnboardingDialog';
import { notificationsApi, usersApi } from '@/lib/api';
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
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ComputerSettingsIcon,
  Sun01Icon,
  DarkModeIcon,
  ComputerIcon,
} from '@hugeicons/core-free-icons';
import {
  Award,
  BarChart3,
  FileSearch,
  Flame,
  Headphones,
  Library,
  Megaphone,
  Mic2,
  Music,
  Network,
  Rss,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import {
  DimensionNavCollapsible,
  DimensionNavSubLink,
  DimensionNavTab,
  DimensionSidebarLogoCard,
  DimensionSidebarUserFooter,
  MoreHorizontal,
  Shield,
} from '@/components/dimension/DimensionSidebarNav';

// Pro-Networx lives on a separate domain. Dashboard users are already
// authenticated, so we route them through the cross-domain auth handoff: their
// session transfers and they land in Pro-Networx without a second sign-in.
// Logged-out visitors reach the public landing via the marketing layout instead.
function getProNetworxOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com'
  )
    .trim()
    .replace(/\/$/, '');
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin;
  } catch {
    return 'https://www.pro-networx.com';
  }
}
const PRO_NETWORX_RETURN_URL = `${getProNetworxOrigin()}/pro-networx/home`;
const PRO_NETWORX_INTERNAL_URL = `/auth-handoff?return_url=${encodeURIComponent(
  PRO_NETWORX_RETURN_URL,
)}`;
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';
type MainNavItem = { name: string; href: string; icon: LucideIcon; external?: boolean };

const listenerNavigation: MainNavItem[] = [
  { name: 'Radio', href: '/listen', icon: Music },
  { name: 'Live DJ', href: '/dj', icon: Headphones },
  { name: 'Live Performances', href: '/performances', icon: Mic2 },
  { name: 'Library', href: '/browse/saved', icon: Library },
  { name: 'Feed', href: '/social', icon: Rss },
  { name: 'Discover', href: '/social/discover', icon: Flame },
  { name: 'Vote', href: '/competition', icon: Megaphone },
  { name: 'The Refinery', href: '/refinery', icon: FileSearch },
  { name: 'Pro-Networx', href: PRO_NETWORX_INTERNAL_URL, icon: Network },
  { name: 'Rewards', href: '/yield', icon: Award },
];

const artistNavigation: MainNavItem[] = [
  { name: 'Radio', href: '/listen', icon: Music },
  { name: 'Live DJ', href: '/dj', icon: Headphones },
  { name: 'Live Performances', href: '/performances', icon: Mic2 },
  { name: 'Library', href: '/browse/saved', icon: Library },
  { name: 'Feed', href: '/social', icon: Rss },
  { name: 'Discover', href: '/social/discover', icon: Flame },
  { name: 'My Uploaded Songs', href: '/artist/songs', icon: UploadCloud },
  { name: 'Analytics', href: '/artist/stats', icon: BarChart3 },
  { name: 'The Refinery', href: '/refinery', icon: FileSearch },
  { name: 'Pro-Networx', href: PRO_NETWORX_INTERNAL_URL, icon: Network },
  { name: 'Rewards', href: '/yield', icon: Award },
];

const moreNav = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Profile', href: '/profile' },
  { name: 'Live', href: '/live' },
  { name: 'Settings', href: '/settings' },
];
const streamerNav = { name: 'Stream settings', href: '/stream-settings' };

const adminSubNavigation = [
  { name: 'Songs', href: '/admin/songs' },
  { name: 'Users', href: '/admin/users' },
  { name: 'Swipe', href: '/admin/swipe' },
  { name: 'Queue', href: '/admin/queue' },
  { name: 'DJ Booth', href: '/admin/dj-booth' },
  { name: 'Streamers', href: '/admin/streamers' },
  { name: 'Feed', href: '/admin/feed' },
  { name: 'Free Rotation', href: '/admin/free-rotation' },
  { name: 'Listen', href: '/listen' },
];

/**
 * Auto-collapse the mobile sidebar overlay whenever the route changes, so
 * tapping a tab takes you straight to the page instead of leaving the menu
 * covering the screen. (Must live inside SidebarProvider to read its context.)
 */
function AutoCollapseSidebarOnNavigate() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);
  return null;
}

// Flattened nav for page title lookup
function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/browse/saved')) return 'Library';
  if (pathname.startsWith('/admin/songs')) return 'Songs';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/swipe')) return 'Swipe';
  if (pathname.startsWith('/admin/queue')) return 'Queue';
  if (pathname.startsWith('/admin/streamers')) return 'Streamers';
  if (pathname.startsWith('/admin/feed')) return 'Feed';
  if (pathname.startsWith('/admin/fallback')) return 'Free Rotation';
  if (pathname.startsWith('/admin/free-rotation')) return 'Free Rotation';
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/browse')) return 'Discover';
  if (pathname.startsWith('/discover')) return 'Discover';
  if (pathname.startsWith('/social/discover')) return 'Discover';
  if (pathname.startsWith('/social')) return 'Feed';
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/listen')) return 'Radio';
  if (pathname.startsWith('/dj')) return 'Live DJ';
  if (pathname.startsWith('/performances')) return 'Live Performances';
  if (pathname.startsWith('/yield')) return 'Rewards';
  if (pathname.startsWith('/refinery')) return 'The Refinery';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/live')) return 'Live';
  if (pathname.startsWith('/stream-settings')) return 'Stream settings';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname === '/artist' || pathname.startsWith('/artist/songs')) return 'My Uploaded Songs';
  if (pathname.startsWith('/artist/upload')) return 'Upload';
  if (pathname.startsWith('/artist/stats')) return 'Analytics';
  if (pathname.startsWith('/artist/live-services')) return 'Live services';
  if (pathname.startsWith('/artist/services')) return 'Pro-Networx';
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
  const { user, profile, loading, signOut, refreshProfile, pendingProfileSetup } =
    useAuth();
  const [adminRoleHint, setAdminRoleHint] = useState(false);
  const [showGenreOnboarding, setShowGenreOnboarding] = useState(false);
  // Confirmed admin hint must override stale profile.role values.
  const effectiveRole = adminRoleHint ? 'admin' : profile?.role;
  const isArtistMode = hasArtistCapability(effectiveRole);
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

  // Fallback role hint: if profile is delayed/missing, still unlock admin UI for allowlisted admins.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAdminRoleHint(false);
      return;
    }
    if (profile?.role === 'admin') {
      setAdminRoleHint(true);
      return;
    }
    const check = async () => {
      try {
        const res = await usersApi.checkAdmin();
        if (!cancelled && res.data?.isAdmin) setAdminRoleHint(true);
      } catch {
        // Keep previous hint value on transient auth/network failures.
      }
    };
    void check();
    const retry = setInterval(() => {
      void check();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(retry);
    };
  }, [user, profile?.role]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cookieRole = document.cookie
      .split('; ')
      .find((c) => c.startsWith('user_role='))
      ?.split('=')[1];
    if (cookieRole?.toLowerCase() === 'admin') {
      setAdminRoleHint(true);
    }
  }, []);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme } = useTheme();

  // Set role cookie for middleware (auth guard on /artist/* and /job-board)
  useEffect(() => {
    if (typeof document === 'undefined' || !effectiveRole) return;
    const role = effectiveRole.toLowerCase();
    document.cookie = `user_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }, [effectiveRole]);

  useEffect(() => {
    if (loading || pendingProfileSetup || !profile) {
      setShowGenreOnboarding(false);
      return;
    }
    if (profile.role === 'admin' || profile.genreOnboardingCompletedAt) {
      setShowGenreOnboarding(false);
      return;
    }
    const createdMs = new Date(profile.createdAt).getTime();
    if (!Number.isFinite(createdMs)) return;
    const maxAccountAgeMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - createdMs > maxAccountAgeMs) {
      setShowGenreOnboarding(false);
      return;
    }
    setShowGenreOnboarding(true);
  }, [loading, pendingProfileSetup, profile]);

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

      const onNotificationsCleared = () => setUnreadCount(0);
      const onNotificationsChanged = () => {
        void fetchUnreadCount();
      };
      window.addEventListener('notifications-cleared', onNotificationsCleared);
      window.addEventListener('notifications-changed', onNotificationsChanged);

      return () => {
        clearInterval(interval);
        window.removeEventListener('notifications-cleared', onNotificationsCleared);
        window.removeEventListener('notifications-changed', onNotificationsChanged);
      };
    }
  }, [user, profile]);

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      setAdminOpen(true);
    }
  }, [pathname]);

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

  const navItems = isArtistMode ? artistNavigation : listenerNavigation;
  const activeHref = navItems
    .filter(
      (it) =>
        pathname === it.href ||
        (it.href !== '/dashboard' && pathname.startsWith(`${it.href}/`)),
    )
    .reduce<string | null>(
      (best, it) => (best && best.length >= it.href.length ? best : it.href),
      null,
    );

  return (
    <div
      data-brand={brandMode}
      data-dimension
      className={isListenPage ? 'h-svh overflow-hidden relative' : 'min-h-screen relative'}
    >
      <div className="pointer-events-none fixed inset-0 z-0 cyber-grid opacity-[0.04]" aria-hidden />
      <SidebarProvider
        style={
          {
            '--sidebar-width': '17.5rem',
            '--sidebar-width-icon': '5rem',
          } as React.CSSProperties
        }
        className={isListenPage ? 'h-svh overflow-hidden relative z-10' : 'relative z-10'}
      >
        <AutoCollapseSidebarOnNavigate />
        <Sidebar
          variant="floating"
          collapsible="icon"
          className="[&_[data-slot=sidebar-inner]]:glass-strong [&_[data-slot=sidebar-inner]]:rounded-3xl [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-white/10 [&_[data-slot=sidebar-inner]]:shadow-none [&_[data-mobile=true]]:glass-strong [&_[data-mobile=true]]:border-white/10"
        >
          <SidebarHeader className="p-3 pb-2">
            <DimensionSidebarLogoCard />
          </SidebarHeader>

          <SidebarContent className="px-2 overflow-y-auto">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <DimensionNavTab
                  key={item.name}
                  href={item.href}
                  label={item.name}
                  icon={item.icon}
                  isActive={activeHref === item.href}
                  external={item.external}
                  testId={`sidebar-tab-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                />
              ))}

              <DimensionNavCollapsible
                title="More"
                icon={MoreHorizontal}
                open={moreOpen}
                onToggle={() => setMoreOpen((v) => !v)}
              >
                {moreNav.map((item) => (
                  <DimensionNavSubLink
                    key={item.name}
                    href={item.href}
                    label={item.name}
                    isActive={
                      pathname === item.href || pathname.startsWith(`${item.href}/`)
                    }
                  />
                ))}
                {hasArtistCapability(effectiveRole) && (
                  <DimensionNavSubLink
                    href={streamerNav.href}
                    label={streamerNav.name}
                    isActive={pathname.startsWith(streamerNav.href)}
                  />
                )}
                {hasArtistCapability(effectiveRole) && (
                  <>
                    <DimensionNavSubLink
                      href="/artist/songs"
                      label="My Uploaded Songs"
                      isActive={pathname.startsWith('/artist/songs')}
                    />
                    <DimensionNavSubLink
                      href="/artist/upload"
                      label="Upload"
                      isActive={pathname.startsWith('/artist/upload')}
                    />
                    <DimensionNavSubLink
                      href="/artist/payouts"
                      label="Payouts"
                      isActive={pathname.startsWith('/artist/payouts')}
                    />
                    <DimensionNavSubLink
                      href="/artist/live-services"
                      label="Live services"
                      isActive={pathname.startsWith('/artist/live-services')}
                    />
                    {profile?.id && (
                      <DimensionNavSubLink
                        href={
                          profile.role === 'service_provider'
                            ? `/pro-networx/u/${profile.id}`
                            : `/artist/${profile.id}`
                        }
                        label="View public profile"
                        isActive={
                          profile.role === 'service_provider'
                            ? pathname.startsWith(`/pro-networx/u/${profile.id}`)
                            : pathname.startsWith(`/artist/${profile.id}`)
                        }
                      />
                    )}
                  </>
                )}
              </DimensionNavCollapsible>

              {effectiveRole === 'admin' && (
                <DimensionNavCollapsible
                  title="Admin"
                  icon={Shield}
                  open={adminOpen}
                  onToggle={() => setAdminOpen((v) => !v)}
                >
                  <DimensionNavSubLink
                    href="/admin"
                    label="Overview"
                    isActive={pathname === '/admin'}
                  />
                  {adminSubNavigation.map((item) => (
                    <DimensionNavSubLink
                      key={item.name}
                      href={item.href}
                      label={item.name}
                      isActive={pathname.startsWith(item.href)}
                    />
                  ))}
                </DimensionNavCollapsible>
              )}
            </nav>
          </SidebarContent>

          <SidebarFooter className="p-3 pb-20 md:pb-3">
            <DimensionSidebarUserFooter
              displayName={profile?.displayName || user.email || 'User'}
              roleLabel={effectiveRole || 'member'}
              avatarUrl={profile?.avatarUrl}
              emailFallback={user.email}
              isSigningOut={isSigningOut}
              onSignOut={() => void handleSignOut()}
              supportUrl={SUPPORT_DISCORD_URL}
            />
          </SidebarFooter>
        </Sidebar>

      <SidebarInset
        className={`bg-transparent ${isListenPage ? 'h-svh overflow-hidden' : ''}`}
      >
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4 md:px-8 glass-strong dimension-chrome dim-text relative">
          <div className="neon-line absolute bottom-0 left-0 right-0" aria-hidden />
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-xl font-semibold text-foreground">
            {getPageTitle(pathname)}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={isArtistMode ? '/artist/upload' : '/competition'}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-cyan-400 text-black font-dim-mono text-[10px] tracking-[0.2em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
            >
              {isArtistMode ? 'Upload' : 'Amplify'}
            </Link>

            <Link
              href="/notifications"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-black/40 hover:border-cyan-400/40 transition-colors"
            >
              <span className="chrome-icon text-sm">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-cyan-400 text-black text-[10px] rounded-full flex items-center justify-center font-dim-mono font-bold ring-2 ring-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

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
          className={`flex-1 min-h-0 bg-transparent flex flex-col ${
            isListenPage
              ? 'overflow-hidden p-0 pb-0'
              : 'overflow-auto p-4 sm:p-6 md:p-8 pb-24'
          }`}
        >
          {children}
        </div>
      </SidebarInset>
      </SidebarProvider>
      {profile && (
        <GenreOnboardingDialog
          open={showGenreOnboarding}
          userId={profile.id}
          onCompleted={() => {
            setShowGenreOnboarding(false);
            void refreshProfile();
          }}
        />
      )}
    </div>
  );
}
