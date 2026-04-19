'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi, prospectorApi, usersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

const WELCOME_HERO_IMAGE = '/images/welcome-to-the-networx.png';

interface DashboardStats {
  platform?: {
    totalArtists: number;
    totalSongs: number;
    totalPlays: number;
    totalProfileClicks: number;
  };
  artist?: {
    totalPlays: number;
    totalListenCount?: number;
    totalSongs: number;
    totalLikes: number;
  };
  yield?: {
    balanceCents: number;
    tier: string;
    songsRefinedCount: number;
  };
}

type Role = 'listener' | 'artist' | 'admin' | 'service_provider';
const PRO_NETWORX_EXTERNAL_URL =
  process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL ||
  'https://www.pro-networx.com/directory';

const ROLE_HOME: Record<
  Role,
  { title: string; subtitle: string; actions: { href: string; icon: string; title: string; desc: string; external?: boolean }[] }
> = {
  listener: {
    title: "Prospector Home",
    subtitle: 'Discover gems, tune in to the radio, and refine songs into signal.',
    actions: [
      { href: '/listen', icon: '🎵', title: 'Listen Now', desc: 'Tune in to the radio stream.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find underground talent and Catalysts (service providers).' },
      { href: '/competition', icon: '🏆', title: 'Competition', desc: 'Leaderboards, diamonds, and Top 7.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with gems and creators.' },
      { href: '/yield', icon: '⛏️', title: 'Rewards', desc: 'Track rewards and redeem at thresholds.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  artist: {
    title: "Gem Home",
    subtitle: 'Upload music and grow your discoveries.',
    actions: [
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Submit tracks to the radio rotation.' },
      { href: '/artist/songs', icon: '🎵', title: 'My Songs', desc: 'Manage your songs.' },
      { href: '/artist/stats', icon: '📈', title: 'Analytics', desc: 'Track listens, engagement, and growth.' },
      { href: '/listen', icon: '🎧', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule and manage live events.' },
      { href: PRO_NETWORX_EXTERNAL_URL, icon: '💼', title: 'Pro-Networx', desc: 'Find and offer creative services.', external: true },
      { href: '/yield', icon: '⛏️', title: 'Rewards', desc: 'Track rewards and redeem at thresholds.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  admin: {
    title: "Admin Home",
    subtitle: 'Manage songs, users, feed, and platform settings.',
    actions: [
      { href: '/admin', icon: '⚙️', title: 'Admin Overview', desc: 'Platform stats and quick actions.' },
      { href: '/admin/songs', icon: '🎶', title: 'Songs', desc: 'Review and moderate submissions.' },
      { href: '/admin/users', icon: '👥', title: 'Users', desc: 'Manage gems and prospectors.' },
      { href: '/admin/queue', icon: '🧵', title: 'Queue', desc: 'Inspect and control upcoming station queue.' },
      { href: '/admin/feed', icon: '📱', title: 'Feed', desc: 'News and promotions.' },
      { href: '/admin/free-rotation', icon: '🔄', title: 'Free Rotation', desc: 'Manage free rotation queue.' },
      { href: '/admin/fallback', icon: '📻', title: 'Fallback', desc: 'Fallback and default tracks.' },
      { href: '/listen', icon: '🎵', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  service_provider: {
    title: "Catalyst (service provider) Home",
    subtitle: "Offer your services to gems and manage your listings.",
    actions: [
      { href: PRO_NETWORX_EXTERNAL_URL, icon: '💼', title: 'Pro-Networx', desc: 'Manage your Catalyst profile and services.', external: true },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule live sessions.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find gems and other providers.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with clients.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
};

function readAdminRoleCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const cookieRole = document.cookie
    .split('; ')
    .find((c) => c.startsWith('user_role='))
    ?.split('=')[1];
  return cookieRole?.toLowerCase() === 'admin';
}

export default function DashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  // Seed the hint synchronously from the cookie that the dashboard layout sets,
  // so admin users land on Admin Home immediately instead of flashing artist UI.
  const [adminRoleHint, setAdminRoleHint] = useState<boolean>(readAdminRoleCookie);
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (profile?.role === 'admin') {
      setAdminRoleHint(true);
      return;
    }
    // Re-check the cookie too in case the layout populated it after first paint.
    if (readAdminRoleCookie()) {
      setAdminRoleHint(true);
    }
    const check = async () => {
      try {
        const res = await usersApi.checkAdmin();
        if (!cancelled && res.data?.isAdmin) setAdminRoleHint(true);
      } catch {
        // Do not clear on transient failures.
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
  }, [profile?.role]);

  const role = ((adminRoleHint ? 'admin' : profile?.role) ?? (authLoading ? null : 'listener')) as Role | null;
  const homeKey: keyof typeof ROLE_HOME = role === 'admin' ? 'admin' : role === 'service_provider' ? 'service_provider' : 'artist';
  const home = role ? (ROLE_HOME[homeKey] ?? ROLE_HOME.artist) : null;
  const hasArtistStats = role === 'artist' || role === 'service_provider';
  const hasProspectorStats = role === 'listener';
  const roleResolved = !!role;

  useEffect(() => {
    async function loadStats() {
      try {
        const next: DashboardStats = {};

        try {
          const platformResponse = await analyticsApi.getPlatformStats();
          const platform = platformResponse.data as {
            totalArtists?: number;
            totalSongs?: number;
            totalPlays?: number;
            totalProfileClicks?: number;
          };
          next.platform = {
            totalArtists: platform.totalArtists ?? 0,
            totalSongs: platform.totalSongs ?? 0,
            totalPlays: platform.totalPlays ?? 0,
            totalProfileClicks: platform.totalProfileClicks ?? 0,
          };
        } catch (platformError) {
          console.error('Failed to load platform stats:', platformError);
        }

        if (hasArtistStats) {
          const artistAnalyticsResponse = await analyticsApi.getMyAnalytics(30);
          const artist = artistAnalyticsResponse.data as {
            totalPlays?: number;
            totalListenCount?: number;
            totalSongs?: number;
            totalLikes?: number;
          };
          next.artist = {
            totalPlays: artist.totalPlays ?? 0,
            totalListenCount: artist.totalListenCount ?? artist.totalPlays ?? 0,
            totalSongs: artist.totalSongs ?? 0,
            totalLikes: artist.totalLikes ?? 0,
          };
        }

        if (hasProspectorStats) {
          const yieldResponse = await prospectorApi.getYield();
          const yieldData = yieldResponse.data as {
            balanceCents?: number;
            tier?: string;
            songsRefinedCount?: number;
          };
          next.yield = {
            balanceCents: yieldData.balanceCents ?? 0,
            tier: yieldData.tier ?? 'none',
            songsRefinedCount: yieldData.songsRefinedCount ?? 0,
          };
        }
        setStats(next);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    if (profile?.id) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [profile?.id, hasArtistStats, hasProspectorStats]);

  return (
    <div className="space-y-8">
      {/* Welcome hero — image only, expanded and centered */}
      <section className="relative w-full overflow-hidden rounded-xl border border-border bg-muted">
        <div className="relative w-full aspect-[2/1] min-h-[240px] flex items-center justify-center">
          <Image
            src={WELCOME_HERO_IMAGE}
            alt=""
            fill
            className="object-contain object-center"
            sizes="100vw"
            priority
            unoptimized
          />
        </div>
      </section>

      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="pt-8">
          {home ? (
            <>
              <h2 className="text-2xl font-bold mb-2">{home.title}</h2>
              <p className="text-primary-foreground/90">{home.subtitle}</p>
            </>
          ) : (
            <>
              <div className="h-8 w-48 bg-primary-foreground/20 rounded animate-pulse mb-2" />
              <div className="h-5 w-72 bg-primary-foreground/10 rounded animate-pulse" />
            </>
          )}
        </CardContent>
      </Card>

      {roleResolved && home && (
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">{home.title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {home.actions.map((action) => (
            <Card key={action.href} className="hover:shadow-md transition-shadow">
              {action.external ? (
                <a href={action.href} target="_blank" rel="noopener noreferrer">
                  <CardContent className="pt-6">
                    <div className="chrome-icon text-base mb-4">{action.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
                    <p className="text-muted-foreground">{action.desc}</p>
                  </CardContent>
                </a>
              ) : (
                <Link href={action.href}>
                  <CardContent className="pt-6">
                    <div className="chrome-icon text-base mb-4">{action.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
                    <p className="text-muted-foreground">{action.desc}</p>
                  </CardContent>
                </Link>
              )}
            </Card>
          ))}
        </div>
      </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Network Snapshot</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-primary/10 rounded-xl p-4">
                <div className="text-sm text-primary font-medium">Artists</div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(stats.platform?.totalArtists ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-sm text-muted-foreground font-medium">Songs</div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(stats.platform?.totalSongs ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-sm text-muted-foreground font-medium">Listens</div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(stats.platform?.totalPlays ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-muted rounded-xl p-4">
                <div className="text-sm text-muted-foreground font-medium">Discoveries</div>
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(stats.platform?.totalProfileClicks ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasArtistStats && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Your Stats</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Your Listens</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.artist?.totalListenCount ?? stats.artist?.totalPlays ?? 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Your Songs</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.artist?.totalSongs ?? 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Your Likes</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.artist?.totalLikes ?? 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasProspectorStats && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Prospector Stats</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/10 rounded-xl p-4">
                  <div className="text-sm text-primary font-medium">Yield Balance</div>
                  <div className="text-3xl font-bold text-foreground mt-1">
                    ${((stats.yield?.balanceCents ?? 0) / 100).toFixed(2)}
                  </div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Tier</div>
                  <div className="text-3xl font-bold text-foreground mt-1 capitalize">
                    {stats.yield?.tier ?? 'none'}
                  </div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Songs Refined</div>
                  <div className="text-3xl font-bold text-foreground mt-1">
                    {stats.yield?.songsRefinedCount ?? 0}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
