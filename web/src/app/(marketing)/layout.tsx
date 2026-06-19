'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { CyberBackdrop, SmoothScroll } from '@/components/dimension';

import { NETWORX_LOGO, NETWORX_LOGO_LIGHT } from '@/lib/brand-assets';

const LOGO_SRC = NETWORX_LOGO;
const LOGO_SRC_LIGHT = NETWORX_LOGO_LIGHT;
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';
const INSTAGRAM_URL = 'https://www.instagram.com/networx_radio/';

const PRO_NETWORX_APP_ORIGIN =
  (process.env.NEXT_PUBLIC_PRO_NETWORX_APP_URL || 'https://www.pro-networx.com').replace(/\/$/, '');

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerLogoError, setHeaderLogoError] = useState(false);
  const [footerLogoError, setFooterLogoError] = useState(false);

  return (
    <div
      data-dimension
      className="relative min-h-screen flex flex-col bg-[#050505] text-white font-outfit overflow-x-clip"
    >
      <SmoothScroll />
      <CyberBackdrop />

      {/* Navigation */}
      <header className="relative z-20 border-b border-white/10 glass-strong">
        <nav className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 h-20">
            <Link href="/" className="flex items-center shrink-0 gap-3 self-stretch">
              {!headerLogoError ? (
                <>
                  <Image
                    src={LOGO_SRC}
                    alt="NETWORX Radio — The Butterfly Effect"
                    width={220}
                    height={220}
                    className="hidden dark:block h-14 sm:h-16 w-auto max-w-[min(220px,44vw)] object-contain object-left shrink-0"
                    priority
                    unoptimized
                    onError={() => setHeaderLogoError(true)}
                  />
                  <Image
                    src={LOGO_SRC_LIGHT}
                    alt="NETWORX Radio — The Butterfly Effect"
                    width={220}
                    height={220}
                    className="block dark:hidden h-14 sm:h-16 w-auto max-w-[min(220px,44vw)] object-contain object-left shrink-0"
                    priority
                    unoptimized
                    onError={() => setHeaderLogoError(true)}
                  />
                </>
              ) : null}
              <span className="hidden lg:inline font-dim-mono text-[10px] tracking-[0.35em] text-cyan-300/90 uppercase whitespace-nowrap">
                THE BUTTERFLY EFFECT
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center space-x-1">
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/features">Features</Link>
                </Button>
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/pricing">Pricing</Link>
                </Button>
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/about">About</Link>
                </Button>
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/faq">FAQ</Link>
                </Button>
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/pro-directory">Pro-Directory</Link>
                </Button>
                <Button variant="ghost" className="text-white/80 hover:text-cyan-300 hover:bg-white/5" asChild>
                  <Link href="/contact">Contact</Link>
                </Button>
              </div>
              <ThemeToggle />
              <Button asChild className="bg-cyan-400 text-black font-dim-mono text-xs tracking-wider uppercase hover:bg-white glow-cyan">
                <Link href="/signup">Sign Up/Login</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 text-white hover:border-pink-400 hover:text-pink-400 font-dim-mono text-xs tracking-wider uppercase">
                <a href={`${PRO_NETWORX_APP_ORIGIN}/pro-networx`}>ProNetworx</a>
              </Button>
            </div>
          </div>
        </nav>
        <div className="neon-line" />
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 glass-strong">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4 min-w-0">
              <Link href="/" className="flex flex-col items-start gap-3 max-w-xs">
                {!footerLogoError ? (
                  <>
                    <Image
                      src={LOGO_SRC}
                      alt="NETWORX Radio — The Butterfly Effect"
                      width={200}
                      height={200}
                      className="hidden dark:block h-20 w-auto max-w-[200px] object-contain object-left shrink-0"
                      unoptimized
                      onError={() => setFooterLogoError(true)}
                    />
                    <Image
                      src={LOGO_SRC_LIGHT}
                      alt="NETWORX Radio — The Butterfly Effect"
                      width={200}
                      height={200}
                      className="block dark:hidden h-20 w-auto max-w-[200px] object-contain object-left shrink-0"
                      unoptimized
                      onError={() => setFooterLogoError(true)}
                    />
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎧</span>
                    <span className="text-lg font-bold leading-snug">NETWORX Radio</span>
                  </>
                )}
              </Link>
              <p className="text-sm text-white/60">
                Where the People have the Voice, and the Artist has the Power. By Artists, For Artists.
              </p>
            </div>

            <div>
              <h3 className="font-unbounded font-bold text-sm mb-4 uppercase tracking-wider">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="text-white/60 hover:text-cyan-300 transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-white/60 hover:text-cyan-300 transition-colors">Pricing</Link></li>
                <li><Link href="/about" className="text-white/60 hover:text-cyan-300 transition-colors">About</Link></li>
                <li><Link href="/faq" className="text-white/60 hover:text-cyan-300 transition-colors">FAQ</Link></li>
                <li><Link href="/pro-directory" className="text-white/60 hover:text-cyan-300 transition-colors">Pro-Directory</Link></li>
                <li>
                  <a
                    href={`${PRO_NETWORX_APP_ORIGIN}/pro-networx/directory`}
                    className="text-white/60 hover:text-cyan-300 transition-colors"
                  >
                    ProNetworx
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-unbounded font-bold text-sm mb-4 uppercase tracking-wider">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-white/60 hover:text-cyan-300 transition-colors">Contact</Link></li>
                <li>
                  <a
                    href={SUPPORT_DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-cyan-300 transition-colors"
                  >
                    Support (Discord)
                  </a>
                </li>
                <li><a href="mailto:tmakuvaza1@networxradio.com" className="text-white/60 hover:text-cyan-300 transition-colors">Tanaka (CEO)</a></li>
                <li><a href="mailto:mjones@networxradio.com" className="text-white/60 hover:text-cyan-300 transition-colors">Merquise (COO)</a></li>
                <li><Link href="/privacy" className="text-white/60 hover:text-cyan-300 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-white/60 hover:text-cyan-300 transition-colors">Terms of Service</Link></li>
                <li><Link href="/dmca" className="text-white/60 hover:text-cyan-300 transition-colors">DMCA &amp; Copyright</Link></li>
                <li><Link href="/community-guidelines" className="text-white/60 hover:text-cyan-300 transition-colors">Community Guidelines</Link></li>
                <li><Link href="/legal" className="text-white/60 hover:text-cyan-300 transition-colors">Legal Center</Link></li>
              </ul>
            </div>

            <div className="md:text-right">
              <h3 className="font-unbounded font-bold text-sm mb-4 uppercase tracking-wider">Follow Us</h3>
              <div className="flex space-x-4 md:justify-end">
                <a href="#" className="text-white/60 hover:text-cyan-300 transition-colors">Twitter</a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-cyan-300 transition-colors"
                >
                  Instagram
                </a>
                <a
                  href={SUPPORT_DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-cyan-300 transition-colors"
                >
                  Discord
                </a>
              </div>
            </div>
          </div>

          <div className="neon-line mt-8 mb-8" />
          <div className="text-sm text-center text-white/50 font-dim-mono tracking-wider">
            <p>&copy; {new Date().getFullYear()} Networx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
