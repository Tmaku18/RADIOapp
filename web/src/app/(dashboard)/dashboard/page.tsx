'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { creditsApi } from '@/lib/api';
import { hasArtistCapability } from '@/lib/roles';
import { Card, CardContent } from '@/components/ui/card';

const WELCOME_HERO_IMAGE = '/images/welcome-to-the-networx.png';

interface DashboardStats {
  credits?: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
}

type Role = 'listener' | 'artist' | 'admin' | 'service_provider';
const PRO_NETWORX_EXTERNAL_URL = 'https://www.discovermeradio.com/pro-networx/directory';

const ROLE_HOME: Record<
  Role,
  { title: string; subtitle: string; actions: { href: string; icon: string; title: string; desc: string; external?: boolean }[] }
> = {
  listener: {
    title: "Prospector Home",
    subtitle: "Discover gems, tune in to the radio, and refine ore's into signal.",
    actions: [
      { href: '/listen', icon: '🎵', title: 'Listen Now', desc: 'Tune in to the radio stream.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find underground talent and Catalysts (service providers).' },
      { href: '/competition', icon: '🏆', title: 'Competition', desc: 'Leaderboards, diamonds, and Top 7.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with gems and creators.' },
      { href: '/yield', icon: '⛏️', title: 'The Yield', desc: 'Track rewards and redeem at thresholds.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  artist: {
    title: "Gem Home",
    subtitle: "Upload music, buy credits, and grow your discoveries.",
    actions: [
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Submit tracks to the radio rotation.' },
      { href: '/artist/songs', icon: '🎵', title: "My Ore's", desc: "Manage your ore's and credits." },
      { href: '/artist/credits', icon: '💰', title: 'Buy Credits', desc: 'Boost your tracks with play credits.' },
      { href: '/artist/stats', icon: '📈', title: 'The Wake', desc: 'The path left behind by a thousand Ripples.' },
      { href: '/listen', icon: '🎧', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule and manage live events.' },
      { href: PRO_NETWORX_EXTERNAL_URL, icon: '💼', title: 'Pro-Networx', desc: 'Find and offer creative services.', external: true },
      { href: '/yield', icon: '⛏️', title: 'The Yield', desc: 'Track rewards and redeem at thresholds.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  admin: {
    title: "Admin Home",
    subtitle: "Manage ore's, users, feed, and platform settings.",
    actions: [
      { href: '/admin', icon: '⚙️', title: 'Admin Overview', desc: 'Platform stats and quick actions.' },
      { href: '/admin/songs', icon: '🎶', title: "Ore's", desc: 'Review and moderate submissions.' },
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

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  // Single user type: non-admin users see full-access (artist) home; admin/catalyst keep their own
  const role = (profile?.role ?? 'artist') as Role;
  const homeKey = role === 'admin' ? 'admin' : role === 'service_provider' ? 'service_provider' : 'artist';
  const home = ROLE_HOME[homeKey] ?? ROLE_HOME.artist;

  useEffect(() => {
    async function loadStats() {
      try {
        if (hasArtistCapability(profile?.role)) {
          const creditsResponse = await creditsApi.getBalance();
          setStats({ credits: creditsResponse.data });
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    if (profile) {
      loadStats();
    }
  }, [profile]);

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
          <h2 className="text-2xl font-bold mb-2">{home.title}</h2>
          <p className="text-primary-foreground/90">
            {home.subtitle}
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">{home.title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {home.actions.map((action) => (
            <Card key={action.href} className="hover:shadow-md transition-shadow">
              {action.external ? (
                <a href={action.href} target="_blank" rel="noopener noreferrer">
                  <CardContent className="pt-6">
                    <div className="text-4xl mb-4">{action.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
                    <p className="text-muted-foreground">{action.desc}</p>
                  </CardContent>
                </a>
              ) : (
                <Link href={action.href}>
                  <CardContent className="pt-6">
                    <div className="text-4xl mb-4">{action.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
                    <p className="text-muted-foreground">{action.desc}</p>
                  </CardContent>
                </Link>
              )}
            </Card>
          ))}
        </div>
      </div>

      {hasArtistCapability(profile?.role) && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Your Stats</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/10 rounded-xl p-4">
                  <div className="text-sm text-primary font-medium">Credit Balance</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.balance ?? 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Total Purchased</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.totalPurchased ?? 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Credits Used</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.totalUsed ?? 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
