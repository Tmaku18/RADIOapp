'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Compass,
  Home,
  LogOut,
  Radio,
  Search,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NETWORX_APP_ICON } from '@/lib/brand-assets';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/pro-networx/home', label: 'Home', icon: Home },
  { href: '/pro-networx/feed', label: 'Discover', icon: Compass },
  { href: '/pro-networx/search', label: 'Search', icon: Search },
  { href: '/pro-networx/services', label: 'Services', icon: Briefcase },
  { href: '/pro-networx/jobs', label: 'Projects', icon: ClipboardList },
  { href: '/pro-networx/radio', label: 'Radio', icon: Radio },
] as const;

const NETWORX_RADIO_DASHBOARD = 'https://www.networxradio.com/dashboard';

type ProNetworxAppShellProps = {
  children: React.ReactNode;
};

export function ProNetworxAppShell({ children }: ProNetworxAppShellProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  const activeTab = TABS.find((t) => pathname?.startsWith(t.href));
  const isMyProfile = pathname?.startsWith('/pro-networx/me');
  const sectionLabel =
    activeTab?.label ?? (isMyProfile ? 'My profile' : 'Pro-Networx');

  return (
    <div className="relative pt-4 min-h-[calc(100vh-5rem)]" data-testid="pro-app-shell">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 grid grid-cols-[64px_1fr] lg:grid-cols-[240px_1fr] gap-5">
        <aside className="sticky top-24 self-start h-[calc(100vh-8rem)] rounded-2xl glass p-3 lg:p-5 flex flex-col gap-1.5">
          <div className="hidden lg:flex items-center gap-2 px-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-black border border-cyan-400/40 glow-cyan overflow-hidden p-0.5">
              <Image
                src={NETWORX_APP_ICON}
                alt=""
                width={28}
                height={28}
                className="w-full h-full object-contain"
                unoptimized
              />
            </div>
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300">
              PRO-NETWORX
            </div>
          </div>

          {TABS.map(({ href, label, icon: Icon }) => {
            const active = activeTab?.href === href;
            return (
              <Link
                key={href}
                href={href}
                data-testid={`pro-tab-${label.toLowerCase()}`}
                title={label}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-dim-mono text-[11px] tracking-[0.2em] uppercase transition-colors',
                  active
                    ? 'bg-cyan-400 text-black font-bold'
                    : 'text-white/70 hover:bg-white/5 hover:text-cyan-300',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline truncate">{label}</span>
              </Link>
            );
          })}

          <Link
            href="/pro-networx/me"
            data-testid="pro-tab-profile"
            title="My profile"
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-dim-mono text-[11px] tracking-[0.2em] uppercase transition-colors',
              isMyProfile
                ? 'bg-cyan-400 text-black font-bold'
                : 'text-white/70 hover:bg-white/5 hover:text-cyan-300',
            )}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline truncate">My profile</span>
            {profile?.role === 'listener' && (
              <span className="ml-auto hidden lg:inline rounded-full bg-black/30 text-[9px] px-1.5 py-0.5">
                Listener
              </span>
            )}
          </Link>

          <div className="mt-auto space-y-1 pt-3 border-t border-white/10">
            <a
              href={
                user
                  ? `/auth-handoff?return_url=${encodeURIComponent(NETWORX_RADIO_DASHBOARD)}`
                  : 'https://www.networxradio.com/'
              }
              data-testid="pro-app-exit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 font-dim-mono text-[11px] tracking-[0.2em] uppercase hover:text-white/90 hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">Back to Radio</span>
            </a>
            <Link
              href="/pro-networx"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 font-dim-mono text-[11px] tracking-[0.2em] uppercase hover:text-white/90 hover:bg-white/5"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">About Pro</span>
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex items-center justify-between mb-4 px-1">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300">
              ◤ NETWORX / PRO-NETWORX / {sectionLabel.toUpperCase()}
            </div>
          </header>
          <main className="pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
