'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Award,
  BarChart3,
  Briefcase,
  Calendar,
  Flame,
  FlaskConical,
  Headphones,
  Heart,
  ListMusic,
  MessageCircle,
  Music,
  Pickaxe,
  RotateCcw,
  Rss,
  Settings,
  Sparkles,
  Trophy,
  UploadCloud,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsApi, prospectorApi, usersApi } from '@/lib/api';
import { Reveal } from '@/components/dimension/Reveal';

const WELCOME_HERO_IMAGE = '/images/welcome-to-the-networx.png';

interface DashboardStats {
  platform?: {
    totalArtists: number;
    totalSongs: number;
    totalPlays: number;
    totalListenCount: number;
    earsReached: number;
    totalLikes: number;
  };
  artist?: {
    totalPlays: number;
    totalListenCount?: number;
    earsReached?: number;
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
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Join Trial by Fire to become an Artist and submit tracks.' },
      { href: '/listen', icon: '🎵', title: 'Listen Now', desc: 'Tune in to the radio stream.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find underground talent and Catalysts (service providers).' },
      { href: '/competition', icon: '🏆', title: 'Competition', desc: 'Leaderboards, diamonds, and Top 7.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with gems and creators.' },
      { href: '/refinery', icon: '🔬', title: 'The Refinery', desc: 'Sign up as a reviewer and earn rewards.' },
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
      { href: '/refinery', icon: '🔬', title: 'The Refinery', desc: 'Get an in-depth review of your song ($4.99).' },
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
      { href: '/listen', icon: '🎵', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  service_provider: {
    title: "Catalyst (service provider) Home",
    subtitle: "Offer your services to gems and manage your listings.",
    actions: [
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Submit tracks to the radio rotation.' },
      { href: PRO_NETWORX_EXTERNAL_URL, icon: '💼', title: 'Pro-Networx', desc: 'Manage your Catalyst profile and services.', external: true },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule live sessions.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find gems and other providers.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with clients.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
};

const ACTION_ICONS: Record<
  string,
  { Icon: ElementType<{ className?: string }>; iconClass: string; borderClass: string }
> = {
  '🎵': { Icon: Music, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '🎶': { Icon: Music, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '🎧': { Icon: Headphones, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
  '✨': { Icon: Sparkles, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  '🏆': { Icon: Trophy, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  '💬': { Icon: MessageCircle, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
  '🔬': { Icon: FlaskConical, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '⛏️': { Icon: Pickaxe, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  '👤': { Icon: User, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '📤': { Icon: UploadCloud, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '📈': { Icon: BarChart3, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
  '📅': { Icon: Calendar, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  '💼': { Icon: Briefcase, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
  '⚙️': { Icon: Settings, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '👥': { Icon: Users, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
  '🧵': { Icon: ListMusic, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  '📱': { Icon: Rss, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
  '🔄': { Icon: RotateCcw, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
};

const PLATFORM_STATS = [
  {
    label: 'Songs',
    key: 'totalSongs' as const,
    Icon: Headphones,
    valueClass: 'text-pink-400',
    borderClass: 'border-pink-400/40',
  },
  {
    label: 'Ears Reached',
    key: 'earsReached' as const,
    Icon: Heart,
    valueClass: 'text-yellow-300',
    borderClass: 'border-yellow-300/40',
  },
  {
    label: 'Listens',
    key: 'totalListenCount' as const,
    Icon: BarChart3,
    valueClass: 'text-cyan-300',
    borderClass: 'border-cyan-400/40',
  },
  {
    label: 'Likes',
    key: 'totalLikes' as const,
    Icon: Flame,
    valueClass: 'text-cyan-300',
    borderClass: 'border-cyan-400/40',
  },
];

function readAdminRoleCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const cookieRole = document.cookie
    .split('; ')
    .find((c) => c.startsWith('user_role='))
    ?.split('=')[1];
  return cookieRole?.toLowerCase() === 'admin';
}

function resolveActionIcon(emoji: string, index: number) {
  const mapped = ACTION_ICONS[emoji];
  if (mapped) return mapped;

  const fallbacks = [
    { Icon: Music, iconClass: 'text-cyan-300', borderClass: 'border-cyan-400/40' },
    { Icon: Award, iconClass: 'text-pink-400', borderClass: 'border-pink-400/40' },
    { Icon: BarChart3, iconClass: 'text-yellow-300', borderClass: 'border-yellow-300/40' },
  ];
  return fallbacks[index % fallbacks.length];
}

function DimensionStatCard({
  label,
  value,
  Icon,
  valueClass,
  borderClass,
}: {
  label: string;
  value: string | number;
  Icon: ElementType<{ className?: string }>;
  valueClass: string;
  borderClass: string;
}) {
  return (
    <div className="rounded-2xl glass p-4 flex items-center gap-3">
      <span
        className={`w-10 h-10 rounded-full bg-black border ${borderClass} flex items-center justify-center shrink-0`}
      >
        <Icon className={`w-4 h-4 ${valueClass}`} />
      </span>
      <div>
        <div className={`font-unbounded font-black text-2xl ${valueClass}`}>{value}</div>
        <div className="font-dim-mono text-[9px] tracking-[0.25em] text-white/50 uppercase">{label}</div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
    </div>
  );
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
  const displayName = profile?.displayName || 'Prospector';

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
            totalListenCount?: number;
            listens?: number;
            earsReached?: number;
            totalLikes?: number;
          };
          next.platform = {
            totalArtists: platform.totalArtists ?? 0,
            totalSongs: platform.totalSongs ?? 0,
            totalPlays: platform.totalPlays ?? 0,
            totalListenCount:
              platform.listens ??
              platform.totalListenCount ??
              0,
            earsReached: platform.earsReached ?? 0,
            totalLikes: platform.totalLikes ?? 0,
          };
        } catch (platformError) {
          console.error('Failed to load platform stats:', platformError);
        }

        if (hasArtistStats) {
          const artistAnalyticsResponse = await analyticsApi.getMyAnalytics(30);
          const artist = artistAnalyticsResponse.data as {
            totalPlays?: number;
            totalListenCount?: number;
            earsReached?: number;
            totalSongs?: number;
            totalLikes?: number;
          };
          next.artist = {
            totalPlays: artist.totalPlays ?? 0,
            totalListenCount: artist.totalListenCount ?? 0,
            earsReached: artist.earsReached ?? 0,
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
    <div data-dimension className="space-y-6">
      {/* Glass hero */}
      <Reveal>
        <div className="relative rounded-3xl glass overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-30" aria-hidden />
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" aria-hidden />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />
          <div className="relative grid md:grid-cols-[1fr_320px] gap-8 p-6 md:p-10 items-center">
            <div>
              <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                ◤ DASHBOARD · WELCOME BACK
              </div>
              {home ? (
                <>
                  <h1 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-5xl leading-[0.95]">
                    Hey{' '}
                    <span className="text-glow-cyan text-cyan-300">{displayName}.</span>
                    <br />
                    Mine the frequency.
                  </h1>
                  <p className="text-white/60 mt-4 max-w-md">{home.subtitle}</p>
                </>
              ) : (
                <>
                  <div className="h-12 w-64 bg-white/10 rounded animate-pulse mb-3" />
                  <div className="h-5 w-72 bg-white/5 rounded animate-pulse" />
                </>
              )}
            </div>
            <div className="relative h-[220px] md:h-[280px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-black/40 border border-cyan-400/20 overflow-hidden">
                <Image
                  src={WELCOME_HERO_IMAGE}
                  alt=""
                  fill
                  className="object-contain object-center p-2"
                  sizes="320px"
                  priority
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Platform stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading ? (
          <div className="col-span-full">
            <LoadingSpinner />
          </div>
        ) : (
          PLATFORM_STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 0.06}>
              <DimensionStatCard
                label={stat.label}
                value={(stats.platform?.[stat.key] ?? 0).toLocaleString()}
                Icon={stat.Icon}
                valueClass={stat.valueClass}
                borderClass={stat.borderClass}
              />
            </Reveal>
          ))
        )}
      </div>

      {/* Quick actions */}
      {roleResolved && home && (
        <Reveal>
          <div className="rounded-2xl glass p-6">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-1">
              QUICK ACTIONS
            </div>
            <h2 className="font-unbounded font-bold text-lg mb-4 dim-text">{home.title}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {home.actions.map((action, index) => {
                const { Icon, iconClass, borderClass } = resolveActionIcon(action.icon, index);
                const tileClassName =
                  'tilt rounded-xl border border-white/10 bg-black/40 p-4 flex items-center gap-3 hover:border-cyan-400/50 block h-full';
                const content = (
                  <>
                    <span
                      className={`w-10 h-10 rounded-full bg-black border ${borderClass} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-4 h-4 ${iconClass}`} />
                    </span>
                    <div>
                      <div className="font-unbounded font-bold text-sm dim-text">{action.title}</div>
                      <div className="text-xs text-white/50">{action.desc}</div>
                    </div>
                  </>
                );

                return action.external ? (
                  <a
                    key={action.href}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={tileClassName}
                  >
                    {content}
                  </a>
                ) : (
                  <Link key={action.href} href={action.href} className={tileClassName}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      {hasArtistStats && (
        <Reveal>
          <div className="rounded-2xl glass p-6">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400 mb-4">
              YOUR STATS
            </div>
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DimensionStatCard
                  label="Ears Reached"
                  value={stats.artist?.earsReached ?? 0}
                  Icon={Heart}
                  valueClass="text-yellow-300"
                  borderClass="border-yellow-300/40"
                />
                <DimensionStatCard
                  label="Listens"
                  value={stats.artist?.totalListenCount ?? 0}
                  Icon={Headphones}
                  valueClass="text-cyan-300"
                  borderClass="border-cyan-400/40"
                />
                <DimensionStatCard
                  label="Your Songs"
                  value={stats.artist?.totalSongs ?? 0}
                  Icon={Music}
                  valueClass="text-pink-400"
                  borderClass="border-pink-400/40"
                />
                <DimensionStatCard
                  label="Your Likes"
                  value={stats.artist?.totalLikes ?? 0}
                  Icon={Heart}
                  valueClass="text-yellow-300"
                  borderClass="border-yellow-300/40"
                />
              </div>
            )}
          </div>
        </Reveal>
      )}

      {hasProspectorStats && (
        <Reveal>
          <div className="rounded-2xl glass p-6">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-4">
              PROSPECTOR STATS
            </div>
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DimensionStatCard
                  label="Yield Balance"
                  value={`$${((stats.yield?.balanceCents ?? 0) / 100).toFixed(2)}`}
                  Icon={Pickaxe}
                  valueClass="text-cyan-300"
                  borderClass="border-cyan-400/40"
                />
                <DimensionStatCard
                  label="Tier"
                  value={(stats.yield?.tier ?? 'none').replace(/^./, (c) => c.toUpperCase())}
                  Icon={Award}
                  valueClass="text-pink-400"
                  borderClass="border-pink-400/40"
                />
                <DimensionStatCard
                  label="Songs Refined"
                  value={stats.yield?.songsRefinedCount ?? 0}
                  Icon={FlaskConical}
                  valueClass="text-yellow-300"
                  borderClass="border-yellow-300/40"
                />
              </div>
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
