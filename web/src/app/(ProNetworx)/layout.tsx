'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, LogOut, Radio } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CyberBackdrop, SmoothScroll } from '@/components/dimension';
import { BassPulseLogo } from '@/components/dimension/BassPulseLogo';
import { useAuth } from '@/contexts/AuthContext';
import { NETWORX_LOGO, NETWORX_LOGO_LIGHT } from '@/lib/brand-assets';
import { getSiteUrl } from '@/lib/site-url';

const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';
const NETWORX_RADIO_ORIGIN = getSiteUrl();
const NETWORX_RADIO_DASHBOARD = `${NETWORX_RADIO_ORIGIN}/dashboard`;
const NETWORX_RADIO_HOME = `${NETWORX_RADIO_ORIGIN}/`;

export default function ProNetworxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [headerLogoError, setHeaderLogoError] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push('/pro-networx');
    } finally {
      setIsSigningOut(false);
    }
  };

  const radioHref = user
    ? `/auth-handoff?return_url=${encodeURIComponent(NETWORX_RADIO_DASHBOARD)}`
    : NETWORX_RADIO_HOME;

  return (
    <div
      data-dimension
      className="relative min-h-screen flex flex-col bg-[var(--dim-bg-base)] text-[var(--dim-text-primary)] font-outfit overflow-x-clip"
    >
      <SmoothScroll />
      <CyberBackdrop />

      <header className="relative z-20 border-b border-white/10 glass-strong dimension-chrome">
        <nav className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 h-20">
            <Link
              href={user ? '/pro-networx/home' : '/pro-networx'}
              className="flex items-center shrink-0 gap-3 self-stretch"
            >
              <BassPulseLogo className="h-14 flex items-center justify-center bg-black px-2 py-1 shrink-0">
                {!headerLogoError ? (
                  <>
                    <Image
                      src={NETWORX_LOGO}
                      alt="NETWORX Radio — The Butterfly Effect"
                      width={220}
                      height={220}
                      className="hidden dark:block h-12 w-auto max-w-[min(200px,40vw)] object-contain object-left"
                      priority
                      unoptimized
                      onError={() => setHeaderLogoError(true)}
                    />
                    <Image
                      src={NETWORX_LOGO_LIGHT}
                      alt="NETWORX Radio — The Butterfly Effect"
                      width={220}
                      height={220}
                      className="block dark:hidden h-12 w-auto max-w-[min(200px,40vw)] object-contain object-left"
                      priority
                      unoptimized
                      onError={() => setHeaderLogoError(true)}
                    />
                  </>
                ) : (
                  <span className="text-lg font-bold px-2">NETWORX</span>
                )}
              </BassPulseLogo>
              <span className="hidden md:inline font-dim-mono text-[10px] tracking-[0.35em] text-yellow-300/90 uppercase whitespace-nowrap">
                · PRO-NETWORX
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={radioHref}
                data-testid="pro-nav-back-radio"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-cyan-400/40 text-cyan-300 font-dim-mono text-[10px] tracking-[0.2em] uppercase hover:bg-cyan-400/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <Radio className="h-4 w-4 hidden sm:block" />
                <span className="hidden sm:inline">Back to Networx Radio</span>
                <span className="sm:hidden">Radio</span>
              </Link>
              <ThemeToggle />
              {!loading && user && (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={isSigningOut}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-white/70 font-dim-mono text-[10px] tracking-[0.2em] uppercase hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isSigningOut ? 'Signing out…' : 'Sign out'}
                  </span>
                </button>
              )}
              {!loading && !user && (
                <>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(pathname || '/pro-networx/home')}`}
                    className="hidden sm:inline-flex px-4 py-2 rounded-full border border-white/20 text-white font-dim-mono text-[10px] tracking-[0.2em] uppercase hover:border-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href={`/signup?redirect=${encodeURIComponent('/pro-networx/home')}`}
                    className="inline-flex px-4 py-2 rounded-full bg-cyan-400 text-black font-dim-mono text-[10px] tracking-[0.25em] uppercase font-bold hover:bg-white transition-colors glow-cyan"
                  >
                    Join free
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
        <div className="neon-line" />
      </header>

      <main className="relative z-10 flex-1 pb-28">{children}</main>

      <footer className="relative z-10 border-t border-white/10 glass-strong dimension-chrome">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-white/60 font-dim-mono tracking-wider">
            <a href={radioHref} className="hover:text-cyan-300 transition-colors">
              Networx Radio
            </a>
            <span className="text-white/30">·</span>
            <Link href="/pro-directory" className="hover:text-cyan-300 transition-colors">
              Pro-Directory
            </Link>
            <span className="text-white/30">·</span>
            <Link href="/contact" className="hover:text-cyan-300 transition-colors">
              Contact
            </Link>
            <span className="text-white/30">·</span>
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-300 transition-colors"
            >
              Support
            </a>
          </div>
          <p className="mt-4 text-sm text-white/50">
            &copy; {new Date().getFullYear()} Networx. By Artists, For Artists.
          </p>
          <p className="mt-3 text-xs text-white/40 max-w-xl mx-auto">
            LinkedIn is a registered trademark of LinkedIn Corporation. PRO-NETWORX
            is not affiliated with, sponsored by, or endorsed by LinkedIn Corporation.
          </p>
        </div>
        <div className="neon-line" />
      </footer>
    </div>
  );
}
