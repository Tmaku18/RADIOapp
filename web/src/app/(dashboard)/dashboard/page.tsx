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

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Only fetch credits for artists
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

  const quickActions = [
    { href: '/listen', icon: '🎵', title: 'Listen Now', desc: 'Tune in to the radio and discover new underground artists.' },
    ...(profile?.role === 'artist' || profile?.role === 'admin' ? [
      { href: '/artist/upload', icon: '📤', title: 'Upload Music', desc: 'Submit your tracks to the radio rotation.' },
      { href: '/artist/credits', icon: '💰', title: 'Buy Credits', desc: 'Boost your tracks with play credits.' },
    ] : []),
    ...(profile?.role === 'admin' ? [{ href: '/admin', icon: '⚙️', title: 'Admin Panel', desc: 'Manage songs, users, and platform settings.' }] : []),
    { href: '/profile', icon: '👤', title: 'Your Profile', desc: 'View and edit your profile information.' },
  ];

  return (
    <div className="space-y-8">
      <Card className="bg-primary text-primary-foreground border-0">
        <CardContent className="pt-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}!
          </h1>
          <p className="text-primary-foreground/90">
            {profile?.role === 'artist' ? 'Ready to share your music with the world?' : profile?.role === 'admin' ? 'Manage the platform from your admin dashboard.' : 'Discover new music on RadioApp.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map((action) => (
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

      {(profile?.role === 'artist' || profile?.role === 'admin') && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Your Stats</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary/10 rounded-xl p-4">
                  <div className="text-sm text-primary font-medium">Credit Balance</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.balance || 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Total Purchased</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.totalPurchased || 0}</div>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <div className="text-sm text-muted-foreground font-medium">Credits Used</div>
                  <div className="text-3xl font-bold text-foreground mt-1">{stats.credits?.totalUsed || 0}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
