'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

function initials(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return 'PN';
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('');
}

function tabClass(active: boolean): string {
  return `px-3 py-1.5 rounded-full text-sm transition-colors ${
    active
      ? 'bg-primary text-primary-foreground shadow-[var(--brand-glow)]'
      : 'text-muted-foreground hover:text-foreground'
  }`;
}

export function GlobalPulseTopBar() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const isActive = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/60 backdrop-blur">
      <div className="container max-w-6xl h-16 flex items-center justify-between gap-3">
        <Link href="/home" className="flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-xl border border-primary/25 bg-primary/10 flex items-center justify-center shadow-[0_0_24px_rgba(0,240,255,0.10)]">
            <span className="text-sm font-semibold">NX</span>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-semibold tracking-tight">PRO‑NETWORX</div>
            <div className="text-xs text-muted-foreground">Systematic Glow</div>
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 rounded-full border border-border/60 bg-card/40 p-1 overflow-x-auto max-w-[62vw] sm:max-w-none">
          <Link href="/home" className={tabClass(isActive('/home'))}>Home</Link>
          <Link href="/search" className={tabClass(isActive('/search'))}>Search</Link>
          <Link href="/services" className={tabClass(isActive('/services'))}>Services</Link>
          <Link href="/radio" className={tabClass(isActive('/radio'))}>Radio</Link>
          <Link href="/directory" className={tabClass(isActive('/directory'))}>Directory</Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/messages">Inbox</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/onboarding">Profile</Link>
          </Button>
          <Avatar size="sm" className="border border-primary/20">
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.displayName ?? 'Avatar'} />
            <AvatarFallback>{initials(profile?.displayName)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
