'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { creditsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardStats {
  credits?: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
  };
}

type Role = 'listener' | 'artist' | 'admin' | 'service_provider';

const ROLE_HOME: Record<
  Role,
  { title: string; subtitle: string; actions: { href: string; icon: string; title: string; desc: string }[] }
> = {
  listener: {
    title: "Listener Home",
    subtitle: "Discover gems, tune in to the radio, and save your favorites.",
    actions: [
      { href: '/listen', icon: '🎵', title: 'Listen Now', desc: 'Tune in to the radio stream.' },
      { href: '/browse', icon: '🔍', title: 'Browse', desc: 'Explore songs and gems.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find underground talent and service providers.' },
      { href: '/competition', icon: '🏆', title: 'Competition', desc: 'Leaderboards, diamonds, and Top 7.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with gems and creators.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  artist: {
    title: "Gem Home",
    subtitle: "Upload music, buy credits, and grow your discoveries.",
    actions: [
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Submit tracks to the radio rotation.' },
      { href: '/artist/songs', icon: '🎵', title: 'My Songs', desc: 'Manage your tracks and credits.' },
      { href: '/artist/credits', icon: '💰', title: 'Buy Credits', desc: 'Boost your tracks with play credits.' },
      { href: '/artist/stats', icon: '📈', title: 'Stats', desc: 'Discoveries, engagement, and analytics.' },
      { href: '/listen', icon: '🎧', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule and manage live events.' },
      { href: '/job-board', icon: '💼', title: 'Pro-Network', desc: 'Find and offer creative services.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  admin: {
    title: "Admin Home",
    subtitle: "Manage songs, users, feed, and platform settings.",
    actions: [
      { href: '/admin', icon: '⚙️', title: 'Admin Overview', desc: 'Platform stats and quick actions.' },
      { href: '/admin/songs', icon: '🎶', title: 'Songs', desc: 'Review and moderate submissions.' },
      { href: '/admin/users', icon: '👥', title: 'Users', desc: 'Manage gems and listeners.' },
      { href: '/admin/feed', icon: '📱', title: 'Feed', desc: 'News and promotions.' },
      { href: '/admin/free-rotation', icon: '🔄', title: 'Free Rotation', desc: 'Manage free rotation queue.' },
      { href: '/admin/fallback', icon: '📻', title: 'Fallback', desc: 'Fallback and default tracks.' },
      { href: '/listen', icon: '🎵', title: 'Listen', desc: 'Tune in to the radio.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
  service_provider: {
    title: "Service Provider Home",
    subtitle: "Offer your services to gems and manage your listings.",
    actions: [
      { href: '/artist/services', icon: '🛠️', title: 'My Services', desc: 'Manage your service offerings.' },
      { href: '/artist/live-services', icon: '📅', title: 'Live Services', desc: 'Schedule live sessions.' },
      { href: '/discover', icon: '✨', title: 'Discover', desc: 'Find gems and other providers.' },
      { href: '/job-board', icon: '💼', title: 'Pro-Network', desc: 'Browse requests and offer services.' },
      { href: '/browse', icon: '🔍', title: 'Browse', desc: 'Explore the platform.' },
      { href: '/messages', icon: '💬', title: 'Messages', desc: 'Chat with clients.' },
      { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile.' },
    ],
  },
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  const role = (profile?.role ?? 'listener') as Role;
  const home = ROLE_HOME[role] ?? ROLE_HOME.listener;

  useEffect(() => {
    async function loadStats() {
      try {
        if (profile?.role === 'artist' || profile?.role === 'admin') {
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
      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="pt-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}!
          </h1>
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
              <Link href={action.href}>
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">{action.icon}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
                  <p className="text-muted-foreground">{action.desc}</p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </div>

      {(profile?.role === 'artist' || profile?.role === 'admin') && (
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
