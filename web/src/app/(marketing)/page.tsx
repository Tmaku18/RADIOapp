import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HeroCta } from '@/components/marketing/HeroCta';
import { LiveRippleVisualizer } from '@/components/marketing/LiveRippleVisualizer';
import { getBackendBaseUrls } from '@/lib/backend-url';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Enable ISR with 60 second revalidation
export const revalidate = 60;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return n.toLocaleString();
}

// The three metaphor systems behind the Networx brand. Keep in sync with
// docs/branding-terminology.md and the mobile About screen glossary.
const GLOSSARY: Array<{
  system: string;
  tagline: string;
  terms: Array<{ term: string; definition: string }>;
}> = [
  {
    system: 'The Butterfly Effect',
    tagline: 'One small ripple can become a storm.',
    terms: [
      {
        term: 'The Butterfly Effect',
        definition:
          'Our core belief: a single vote or discovery can set off the chain reaction that launches an artist\u2019s career.',
      },
      {
        term: 'Ripples',
        definition:
          'The audience\u2019s votes and likes. Every ripple carries an artist\u2019s sound a little further across the network.',
      },
      {
        term: 'The Wake',
        definition:
          'An artist\u2019s analytics report \u2014 the path left behind by a thousand Ripples, showing reach, engagement, and growth.',
      },
    ],
  },
  {
    system: 'Metamorphosis',
    tagline: 'The journey from unseen talent to recognized artist.',
    terms: [
      {
        term: 'Metamorphosis',
        definition:
          'The transformation every artist undergoes on Networx \u2014 from an unknown upload to a name the people know.',
      },
      {
        term: 'Gem',
        definition: 'An artist. A hidden gem, ready to be heard and refined by the community.',
      },
      {
        term: 'Diamond',
        definition:
          'A Gem refined under pressure \u2014 a standout artist the community has voted into the spotlight.',
      },
      {
        term: 'Catalyst',
        definition:
          'A creative service provider (producer, photographer, mentor) who speeds up the metamorphosis through ProNetworx.',
      },
    ],
  },
  {
    system: 'Mining',
    tagline: 'Surfacing value from the live frequency.',
    terms: [
      {
        term: 'Mining the Frequency',
        definition:
          'How value is surfaced from the always-on stream \u2014 the people dig through the radio to find what shines.',
      },
      {
        term: 'Prospectors',
        definition:
          'The listeners. They tune in, send Ripples, and refine raw songs into signal the market can trust.',
      },
      {
        term: 'The Refinery',
        definition:
          'The portal where Prospectors rank, survey, and comment to refine songs before they break out.',
      },
      {
        term: 'The Yield',
        definition:
          'A Prospector\u2019s rewards \u2014 steady earnings from verified engagement like refinement, surveys, and feedback.',
      },
    ],
  },
];

// Fetch platform stats from the API
async function getHomepageData() {
  const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        next: { revalidate: 60 },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    for (const baseUrl of getBackendBaseUrls()) {
      const stats = await fetchJsonWithTimeout<{
        totalUsers?: number;
        totalSongs?: number;
        earsReached?: number;
        totalLikes?: number;
      }>(`${baseUrl}/api/analytics/platform`);
      if (!stats) continue;

      return {
        stats: {
          totalUsers: stats.totalUsers ?? 0,
          totalSongs: stats.totalSongs ?? 0,
          earsReached: stats.earsReached ?? 0,
          totalLikes: stats.totalLikes ?? 0,
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch platform stats:', error);
  }

  // Fallback to default data
  return {
    stats: {
      totalUsers: 0,
      totalSongs: 0,
      earsReached: 0,
      totalLikes: 0,
    },
  };
}

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <div>
      {/* Hero — Join the movement (primary CTA above the fold) */}
      <section className="py-24 sm:py-32 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Join the movement and build your network
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Whether you are a hidden gem ready to be heard, a Prospector discovering new talent, or a pro ready to mentor, Networx and ProNetworx create the bridge.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="border-2 border-primary-foreground/90 shadow-md !text-black" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground/15" asChild>
              <Link href="/pro-networx">
                Explore ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Supporting hero — platform value prop + visualizer */}
      <section className="relative py-16 sm:py-20 overflow-hidden border-b border-border">
        <LiveRippleVisualizer />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Build your audience, team, and career in one platform
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Always-on radio, livestreams, votes and ripples, transparent analytics, and ProNetworx mentorship.
          </p>
          <HeroCta />
        </div>
      </section>

      {/* Stats Section — live platform totals */}
      <section className="py-16 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { value: formatCount(data.stats.totalUsers), label: 'Members', sub: '(total users)' },
              { value: formatCount(data.stats.totalSongs), label: 'Songs', sub: '(uploaded)' },
              { value: formatCount(data.stats.earsReached), label: 'Ears Reached', sub: '(live radio listeners)' },
              { value: formatCount(data.stats.totalLikes), label: 'Ripples', sub: '(total likes)' },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
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

      {/* The Language of Networx — branding glossary (three metaphor systems) */}
      <section className="py-20 bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
              The Language of Networx
            </h2>
            <p className="text-lg text-primary-foreground/80">
              Our world runs on three ideas: the <strong>Butterfly Effect</strong>, the artist&apos;s{' '}
              <strong>Metamorphosis</strong>, and the <strong>Mining</strong> of hidden talent. Here is what every term means.
            </p>
          </div>

          <div className="space-y-12">
            {GLOSSARY.map((group) => (
              <div key={group.system}>
                <div className="mb-6 text-center sm:text-left">
                  <h3 className="text-2xl font-bold text-primary-foreground">{group.system}</h3>
                  <p className="text-primary-foreground/70 mt-1">{group.tagline}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.terms.map((t) => (
                    <Card key={t.term} className="text-left h-full">
                      <CardContent className="pt-6">
                        <div className="text-lg font-semibold text-primary">{t.term}</div>
                        <p className="text-muted-foreground mt-2 leading-relaxed">{t.definition}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Button variant="secondary" size="lg" className="border-2 border-primary-foreground/90 shadow-md !text-black" asChild>
              <Link href="/about">Read our full story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA — closing black/white slot */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="!text-black" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pro-networx">
                Explore ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
