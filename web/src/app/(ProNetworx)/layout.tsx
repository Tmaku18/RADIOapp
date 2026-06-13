'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

import { NETWORX_LOGO, NETWORX_LOGO_LIGHT } from '@/lib/brand-assets';
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';
const NETWORX_RADIO_ORIGIN = 'https://www.networxradio.com';
const NETWORX_RADIO_DASHBOARD = `${NETWORX_RADIO_ORIGIN}/dashboard`;
const NETWORX_RADIO_HOME = `${NETWORX_RADIO_ORIGIN}/`;

export default function ProNetworxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <header className="border-b border-border bg-card">
        <nav className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 h-16">
            <Link href={user ? '/pro-networx/home' : '/pro-networx'} className="flex items-center shrink-0 gap-3">
              <Image
                src={NETWORX_LOGO}
                alt="NETWORX Radio — The Butterfly Effect"
                width={220}
                height={64}
                className="hidden dark:block h-12 w-auto max-w-[min(220px,55vw)] object-contain object-left shrink-0"
                priority
                unoptimized
              />
              <Image
                src={NETWORX_LOGO_LIGHT}
                alt="NETWORX Radio — The Butterfly Effect"
                width={220}
                height={64}
                className="block dark:hidden h-12 w-auto max-w-[min(220px,55vw)] object-contain object-left shrink-0"
                priority
                unoptimized
              />
              <span className="hidden md:inline text-primary font-semibold text-sm tracking-tight">
                · PRO‑NETWORX
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <a
                  href={
                    user
                      ? `/auth-handoff?return_url=${encodeURIComponent(NETWORX_RADIO_DASHBOARD)}`
                      : NETWORX_RADIO_HOME
                  }
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <Radio className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Networks Radio</span>
                  <span className="sm:hidden">Radio</span>
                </a>
              </Button>
              <ThemeToggle />
              {!loading && !user && (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/login?redirect=${encodeURIComponent(pathname || '/pro-networx/home')}`}>
                      Login
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="bg-primary text-primary-foreground hover:opacity-90">
                    <Link href={`/signup?redirect=${encodeURIComponent('/pro-networx/home')}`}>
                      Join free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <a href={user ? `/auth-handoff?return_url=${encodeURIComponent(NETWORX_RADIO_DASHBOARD)}` : NETWORX_RADIO_HOME} className="hover:text-foreground transition-colors">Networx Radio</a>
          {' · '}
          <Link href="/pro-directory" className="hover:text-foreground transition-colors">Pro-Directory</Link>
          {' · '}
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          {' · '}
          <a
            href={SUPPORT_DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Support
          </a>
          <p className="mt-2">&copy; {new Date().getFullYear()} Networx. By Artists, For Artists.</p>
          <p className="mt-3 text-xs text-muted-foreground max-w-xl mx-auto">
            LinkedIn is a registered trademark of LinkedIn Corporation. PRO-NETWORX is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation.
          </p>
        </div>
      </footer>
    </div>
  );
}
