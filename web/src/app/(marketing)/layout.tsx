'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const LOGO_SRC = '/networx-logo.png';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerLogoError, setHeaderLogoError] = useState(false);
  const [footerLogoError, setFooterLogoError] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-card">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo + brand text, aligned left */}
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

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/about">About</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/pricing">Pricing</Link>
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

            {/* Auth Buttons */}
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="bg-networx text-black hover:opacity-90">
                <Link href="/signup">Get Started</Link>
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
      <footer className="bg-muted/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <Link href="/" className="inline-flex items-center gap-3">
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
                    <span className="text-networx font-bold text-base whitespace-nowrap">
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
              <p className="text-sm text-muted-foreground">
                Where the People have the Voice, and the Artist has the Power. By Artists, For Artists.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/pro-directory" className="text-muted-foreground hover:text-foreground transition-colors">Pro-Directory</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Instagram</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Discord</a>
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
