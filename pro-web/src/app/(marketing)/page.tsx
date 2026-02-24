import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HeroCta } from '@/components/marketing/HeroCta';
import { LiveRippleVisualizer } from '@/components/marketing/LiveRippleVisualizer';

// Enable ISR with 60 second revalidation
export const revalidate = 60;

export default async function HomePage() {
  return (
    <div>
      {/* Hero — Strategic Minimalism, Systematic Glow */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <LiveRippleVisualizer />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
            Hire the Collective.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            PRO‑NETWORX is the directory for artists, producers, studios, designers, photographers, and managers — a gig‑first network wrapped in neon.
          </p>
          <HeroCta />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: 'Skill-first', label: 'Discovery', sub: 'by what you do' },
              { value: 'Gig-first', label: 'Service Cards', sub: 'portfolio + pricing' },
              { value: 'Presence', label: 'Live dots', sub: 'who is active' },
              { value: 'Paywalled DMs', label: 'Creator Network', sub: 'subscription required' },
            ].map((stat) => (
              <Card key={stat.label} className="text-center border border-primary/15 bg-card/50">
                <CardContent className="pt-6">
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-muted-foreground mt-2">{stat.label}</div>
                  <div className="text-muted-foreground/80 text-sm mt-0.5">{stat.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="service-card">
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Directory</h3>
                <p className="text-muted-foreground">Search by skill, availability, and region.</p>
                <Button asChild>
                  <Link href="/directory">Browse</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="service-card">
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Onboarding</h3>
                <p className="text-muted-foreground">Set skills, headline, and availability.</p>
                <Button variant="outline" asChild>
                  <Link href="/onboarding">Build profile</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="service-card">
              <CardContent className="pt-6 space-y-3">
                <h3 className="text-xl font-semibold text-foreground">Inbox</h3>
                <p className="text-muted-foreground">Smart threads. Paywalled sends.</p>
                <Button variant="secondary" asChild>
                  <Link href="/messages">Open inbox</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
