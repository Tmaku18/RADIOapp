'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Search,
  Briefcase,
  ClipboardList,
  Radio,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/pro-networx/home', label: 'Home', icon: Home },
  { href: '/pro-networx/search', label: 'Search', icon: Search },
  { href: '/pro-networx/services', label: 'Services', icon: Briefcase },
  { href: '/pro-networx/jobs', label: 'Projects', icon: ClipboardList },
  { href: '/pro-networx/radio', label: 'Radio', icon: Radio },
] as const;

export default function ProNetworxDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // Authenticated app shell. Listeners are allowed: they can browse + view
  // profiles. The DM gate, posting, profile editing, and listing services are
  // gated downstream.
  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(pathname || '/pro-networx/home');
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, user, router, pathname]);

  if (!loading && !user) return null;

  const activeTab = TABS.find((t) => pathname?.startsWith(t.href));
  const isMyProfile = pathname?.startsWith('/pro-networx/me');

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <nav className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab?.href === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
          <div className="ml-auto">
            <Link
              href="/pro-networx/me"
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2',
                isMyProfile
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <UserIcon className="h-4 w-4" />
              <span>My profile</span>
              {profile?.role === 'listener' && (
                <span className="ml-1 rounded-full bg-muted text-foreground/70 text-[10px] px-1.5 py-0.5">
                  Listener
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
