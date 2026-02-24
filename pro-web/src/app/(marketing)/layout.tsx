'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { GlobalPulseTopBar } from '@/components/pro/GlobalPulseTopBar';

const LOGO_SRC = '/networx-logo.png';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [footerLogoError, setFooterLogoError] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <GlobalPulseTopBar />

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
                      PRO‑NETWORX
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">💼</span>
                    <span className="text-xl font-bold text-networx">PRO‑NETWORX</span>
                  </>
                )}
              </Link>
              <p className="text-sm text-muted-foreground">
                The Collective Directory — find catalysts, book services, and build in public.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link href="/directory" className="text-muted-foreground hover:text-foreground transition-colors">Directory</Link></li>
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
