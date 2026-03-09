'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ProNetworxDirectoryContent } from './DirectoryContent';

export default function ProNetworxHomePage() {
  const { user, loading } = useAuth();

  // Logged in: show directory (users, search, scroll) — LinkedIn/Fiverr-style home
  if (!loading && user) {
    return (
      <ProNetworxDirectoryContent
        title="Explore"
        subtitle="Search and connect with Catalysts. Browse by skill, location, and availability."
        showEditProfile
      />
    );
  }

  // Not logged in: marketing landing
  return (
    <div className="relative">
      <section className="relative py-20 sm:py-28 overflow-hidden bg-signature">
        <div
          className="absolute inset-0 opacity-30 bg-[length:220px_220px]"
          style={{ backgroundImage: 'var(--grain)' }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Hire the Collective.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            PRO-NETWORX is the professional layer: <span className="text-foreground">Catalysts</span> with LinkedIn-style profiles and Fiverr-style gigs. Find producers, designers, and mentors—skill-first.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--brand-glow)]">
              <Link href="/login?redirect=%2Fpro-networx">Log in</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup?redirect=%2Fpro-networx">Sign up</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary/30">
              <Link href="/pro-networx/directory">Browse directory</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-10">
            Why ProNetworx
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Skill-first discovery', sub: 'Search by skill, location, and availability' },
              { title: 'Gig-first cards', sub: 'Service titles, Starting at $X, portfolio preview' },
              { title: 'Verified Catalysts', sub: 'Industry Catalysts with portfolio and listings' },
              { title: 'Mentorship', sub: 'Mentors who opt in to support artists' },
            ].map((item) => (
              <Card key={item.title} className="glass-panel border border-border hover:border-primary/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="font-semibold text-foreground">{item.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{item.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground mb-6">
            Sign in to browse Catalysts, message pros, and build your profile.
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href="/pro-networx">Get started</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
