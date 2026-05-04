import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PRO_NETWORX_REGULAR_DISPLAY,
  PRO_NETWORX_INTRO_DISPLAY,
} from '@/data/pro-networx-pricing';

const REDIRECT_APP = '/pro-networx/home';
const REDIRECT_APP_ENCODED = encodeURIComponent(REDIRECT_APP);

const CREATIVE_KINDS = [
  { emoji: '🎨', label: 'Graphic designers' },
  { emoji: '📷', label: 'Photographers' },
  { emoji: '🎬', label: 'Videographers' },
  { emoji: '✏️', label: 'Illustrators' },
  { emoji: '🎤', label: 'Lyricists' },
  { emoji: '🥁', label: 'Beat makers' },
  { emoji: '🎚️', label: 'Engineers' },
  { emoji: '👕', label: 'Stylists' },
];

export default function ProNetworxLandingPage() {
  return (
    <div className="relative">
      <section className="relative overflow-hidden py-20 sm:py-28 bg-signature">
        <div
          className="absolute inset-0 opacity-30 bg-[length:220px_220px]"
          style={{ backgroundImage: 'var(--grain)' }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            The networking app for every kind of creative.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Pro Networks is where graphic designers, photographers, videographers,
            illustrators, lyricists, beat makers and the rest of the creative
            world post their work, get hired, and connect with each other.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--brand-glow)]"
            >
              <Link href={`/signup?redirect=${REDIRECT_APP_ENCODED}`}>
                Create your profile — free
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary/30">
              <Link href={`/login?redirect=${REDIRECT_APP_ENCODED}`}>Log in</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/pro-networx/search">Browse the feed</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            One login for both Networks Radio and Pro Networks.
          </p>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center text-foreground mb-3">
            Built for every creative discipline.
          </h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            If you make something, this is for you.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {CREATIVE_KINDS.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card/60 p-4 flex items-center gap-3"
              >
                <span className="text-2xl" aria-hidden>{item.emoji}</span>
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center text-foreground mb-10">
            Everything you need in one place.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'A LinkedIn-style profile',
                sub:
                  'Banner, avatar, headline, about, skills, experience, education, resume PDF, and links to every social.',
              },
              {
                title: 'An Instagram-style feed',
                sub:
                  'Home shows posts from people you follow. Search opens a tile grid you can scroll forever.',
              },
              {
                title: 'A services marketplace',
                sub:
                  'List what you do, set a price, and let buyers find you. Contact info revealed to subscribers.',
              },
              {
                title: 'Direct messaging',
                sub:
                  'Message anyone with an active subscription — no follow gate, no friction.',
              },
              {
                title: 'Background radio',
                sub:
                  'Tap the Radio tab to keep Networks Radio playing while you scroll.',
              },
              {
                title: 'One account, both worlds',
                sub:
                  'Your Pro Networks profile is auto-seeded from Networks Radio, and vice versa.',
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="glass-panel border border-border hover:border-primary/30 transition-colors"
              >
                <CardContent className="pt-6">
                  <div className="font-semibold text-foreground">
                    {item.title}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {item.sub}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="border-primary/40 shadow-[var(--brand-glow)]">
            <CardContent className="p-8 text-center">
              <p className="text-sm uppercase tracking-wide text-primary font-semibold">
                Subscription
              </p>
              <h3 className="mt-2 text-3xl font-semibold text-foreground">
                Unlock messaging + contact info
              </h3>
              <p className="mt-3 text-muted-foreground">
                Browse, post and build your profile for free. Subscribe to send
                DMs and view contact info on services listings.
              </p>
              <div className="mt-6 flex items-baseline justify-center gap-3">
                <span className="text-2xl line-through text-muted-foreground">
                  {PRO_NETWORX_REGULAR_DISPLAY}
                </span>
                <span className="text-4xl font-bold text-primary">
                  {PRO_NETWORX_INTRO_DISPLAY}
                </span>
                <span className="text-sm text-muted-foreground">first month</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Then {PRO_NETWORX_REGULAR_DISPLAY}/month. Cancel anytime.
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="bg-primary text-primary-foreground">
                  <Link href={`/signup?redirect=${REDIRECT_APP_ENCODED}`}>
                    Get started
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground mb-6">
            Already have a Networks Radio account? Your profile is already
            waiting for you.
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href={`/login?redirect=${REDIRECT_APP_ENCODED}`}>
              Sign in
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
