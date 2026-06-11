'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const LOGO_SRC = '/networx-logo.png';
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
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/65">
        <nav className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center gap-4 h-20">
            {/* Logo + brand text, pinned to the far left */}
            <Link href="/" className="flex items-center shrink-0 gap-4 self-stretch">
              {!headerLogoError ? (
                <>
                  <Image
                    src={LOGO_SRC}
                    alt=""
                    width={260}
                    height={92}
                    className="h-14 w-auto object-contain object-left dark:invert-0 shrink-0"
                    priority
                    unoptimized
                    onError={() => setHeaderLogoError(true)}
                  />
                  <span className="text-networx font-bold text-lg whitespace-nowrap">
                    NETWORX Radio: &ldquo;The Butterfly Effect&rdquo;
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl">🎧</span>
                  <span className="text-xl font-bold text-networx">NETWORX Radio: &ldquo;The Butterfly Effect&rdquo;</span>
                </>
              )}
            </Link>

            {/* Nav links + auth, grouped together and pinned to the far right */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center space-x-1">
                <Button variant="ghost" asChild>
                  <Link href="/features">Features</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/pricing">Pricing</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/about">About</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/faq">FAQ</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/pro-directory">Pro-Directory</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/contact">Contact</Link>
                </Button>
              </div>
              <ThemeToggle />
              <Button asChild className="bg-networx text-black hover:opacity-90">
                <Link href="/signup">Sign Up/Login</Link>
              </Button>
              <Button asChild className="bg-networx text-black hover:opacity-90">
                <a href={`${PRO_NETWORX_APP_ORIGIN}/pro-networx`}>ProNetworx</a>
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-muted/40 backdrop-blur-md border-t border-border">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4 min-w-0">
              <Link href="/" className="flex flex-col items-start gap-3 max-w-xs">
                {!footerLogoError ? (
                  <>
                    <Image
                      src={LOGO_SRC}
                      alt=""
                      width={220}
                      height={78}
                      className="h-12 w-auto object-contain object-left shrink-0"
                      unoptimized
                      onError={() => setFooterLogoError(true)}
                    />
                    <span className="text-foreground font-bold text-base leading-snug">
                      NETWORX Radio: &ldquo;The Butterfly Effect&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎧</span>
                    <span className="text-lg font-bold text-foreground leading-snug">NETWORX Radio: &ldquo;The Butterfly Effect&rdquo;</span>
                  </>
                )}
              </Link>
              <p className="text-sm text-muted-foreground">
                Where the People have the Voice, and the Artist has the Power. By Artists, For Artists.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/pro-directory" className="text-muted-foreground hover:text-foreground transition-colors">Pro-Directory</Link></li>
                <li>
                  <a
                    href={`${PRO_NETWORX_APP_ORIGIN}/pro-networx/directory`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ProNetworx
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
                <li>
                  <a
                    href={SUPPORT_DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Support (Discord)
                  </a>
                </li>
                <li><a href="mailto:tmakuvaza1@networxradio.com" className="text-muted-foreground hover:text-foreground transition-colors">Tanaka (CEO)</a></li>
                <li><a href="mailto:mjones@networxradio.com" className="text-muted-foreground hover:text-foreground transition-colors">Merquise (COO)</a></li>
                <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/legal" className="text-muted-foreground hover:text-foreground transition-colors">Legal Center</Link></li>
              </ul>
            </div>

            {/* Social */}
            <div className="md:text-right">
              <h3 className="font-semibold text-foreground mb-4">Follow Us</h3>
              <div className="flex space-x-4 md:justify-end">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Instagram
                </a>
                <a
                  href={SUPPORT_DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Discord
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 text-sm text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Networx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
