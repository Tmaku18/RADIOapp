'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const LOGO_SRC = '/networx-logo.png';
const NETWORXRADIO_CROSS_LOGIN = 'https://www.networxradio.com/cross-domain-login';

function isDiscoverMeHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'discovermeradio.com' || h === 'www.discovermeradio.com';
}

export default function ProNetworxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <nav className="max-w-7xl mx-auto pl-0 pr-4 sm:pl-0 sm:pr-6 lg:pl-0 lg:pr-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/pro-networx" className="flex items-center shrink-0 gap-3">
              <Image
                src={LOGO_SRC}
                alt="Networx Radio — The Butterfly Effect"
                width={140}
                height={50}
                className="h-10 w-auto object-contain object-left shrink-0"
                priority
                unoptimized
              />
              <span className="text-primary font-semibold text-sm sm:text-base tracking-tight">
                PRO-NETWORX
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pro-networx">Home</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pro-networx/directory">Directory</Link>
              </Button>
              {!loading && (
                user ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/pro-networx/onboarding">My profile</Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/login?redirect=${encodeURIComponent(pathname || '/pro-networx/directory')}`}>
                        Login
                      </Link>
                    </Button>
                    <Button size="sm" asChild className="bg-primary text-primary-foreground hover:opacity-90">
                      <Link href={`/signup?redirect=${encodeURIComponent('/pro-networx/directory')}`}>
                        Sign up
                      </Link>
                    </Button>
                  </>
                )
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
          {isDiscoverMeHost() ? (
            <Link
              href={`/auth-handoff?return_url=${encodeURIComponent(NETWORXRADIO_CROSS_LOGIN)}`}
              className="hover:text-foreground transition-colors"
            >
              Networx Radio
            </Link>
          ) : (
            <Link href="/" className="hover:text-foreground transition-colors">Networx Radio</Link>
          )}
          {' · '}
          <Link href="/pro-directory" className="hover:text-foreground transition-colors">Pro-Directory</Link>
          {' · '}
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <p className="mt-2">&copy; {new Date().getFullYear()} Networx. By Artists, For Artists.</p>
        </div>
      </footer>
    </div>
  );
}
