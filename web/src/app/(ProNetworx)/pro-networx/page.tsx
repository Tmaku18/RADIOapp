import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';
import {
  PRO_NETWORX_REGULAR_DISPLAY,
  PRO_NETWORX_INTRO_DISPLAY,
} from '@/data/pro-networx-pricing';
import { LandingCta } from './LandingCta';

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

const FEATURES = [
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
      'Tap the Radio tab to keep Networx Radio playing while you scroll.',
  },
  {
    title: 'One account, both worlds',
    sub:
      'Your Pro-Networx profile is auto-seeded from Networx Radio, and vice versa.',
  },
];

export default function ProNetworxLandingPage() {
  return (
    <div className="relative">
      {/* Hero — full teal with butterfly pattern, mirrors the marketing home. */}
      <section className="relative overflow-hidden py-24 sm:py-32 bg-primary text-primary-foreground">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary-foreground"
          tile={150}
          opacity={0.14}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            The networking app for every kind of creative.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Pro-Networx is where graphic designers, photographers, videographers,
            illustrators, lyricists, beat makers and the rest of the creative
            world post their work, get hired, and connect with each other.
          </p>
          <LandingCta />
          <p className="mt-4 text-sm text-primary-foreground/70">
            One login for both Networx Radio and Pro-Networx.
          </p>
        </div>
      </section>

      {/* Creative disciplines — soft section with subtle butterfly accent. */}
      <section className="relative overflow-hidden py-16 sm:py-20 border-b border-border bg-background">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary"
          tile={140}
          opacity={0.1}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-3 tracking-tight">
            Built for every creative discipline.
          </h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            If you make something, this is for you.
          </p>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {CREATIVE_KINDS.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm"
              >
                <span className="text-2xl" aria-hidden>{item.emoji}</span>
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid — clean cards on the canvas background. */}
      <section className="py-16 sm:py-20 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-foreground mb-10 tracking-tight">
            Everything you need in one place.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((item) => (
              <Card
                key={item.title}
                className="bg-card border border-border hover:border-primary/40 transition-colors"
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

      {/* Subscription — second teal hero band, matches marketing rhythm. */}
      <section className="relative overflow-hidden py-20 sm:py-24 bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary-foreground"
          tile={160}
          opacity={0.13}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-primary-foreground/20 bg-primary-foreground/5 backdrop-blur-sm p-8 sm:p-10 text-center">
            <p className="text-sm uppercase tracking-wide text-primary-foreground/80 font-semibold">
              Subscription
            </p>
            <h3 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
              Unlock messaging + contact info
            </h3>
            <p className="mt-3 text-primary-foreground/85">
              Browse, post and build your profile for free. Subscribe to send
              DMs and view contact info on services listings.
            </p>
            <div className="mt-6 flex items-baseline justify-center gap-3 flex-wrap">
              <span className="text-2xl line-through text-primary-foreground/60">
                {PRO_NETWORX_REGULAR_DISPLAY}
              </span>
              <span className="text-4xl sm:text-5xl font-bold">
                {PRO_NETWORX_INTRO_DISPLAY}
              </span>
              <span className="text-sm text-primary-foreground/70">first month</span>
            </div>
            <p className="mt-2 text-xs text-primary-foreground/70">
              Then {PRO_NETWORX_REGULAR_DISPLAY}/month. Cancel anytime.
            </p>
            <div className="mt-6">
              <Button
                asChild
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Link href={`/signup?redirect=${REDIRECT_APP_ENCODED}`}>
                  Get started
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final returning-member CTA — canvas background with butterfly pattern. */}
      <section className="relative overflow-hidden py-16 sm:py-20 bg-background">
        <ButterflyPattern
          className="absolute inset-0"
          colorClassName="text-primary"
          tile={130}
          opacity={0.1}
        />
        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground mb-6">
            Already have a Networx Radio account? Your profile is already
            waiting for you.
          </p>
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href={`/login?redirect=${REDIRECT_APP_ENCODED}`}>
              Sign in
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
