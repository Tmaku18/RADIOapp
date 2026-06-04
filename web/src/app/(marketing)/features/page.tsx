import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Features - Networx',
  description:
    'Everything Networx does: live radio discovery, community up/down voting, a direct-to-fan marketplace, verified listener exposure, artist livestreaming, The Refinery, The Yield, transparent analytics, and the ProNetworx creative marketplace.',
};

export const revalidate = 3600;

type Feature = {
  title: string;
  tag?: string;
  comingSoon?: boolean;
  body: string;
  points?: string[];
};

type FeatureGroup = {
  audience: string;
  tagline: string;
  features: Feature[];
};

const GROUPS: FeatureGroup[] = [
  {
    audience: 'For Prospectors (Listeners)',
    tagline: 'Discover underground artists live, and help decide who rises.',
    features: [
      {
        title: 'Live Radio Discovery',
        body: 'Music is experienced in a live environment, not a lonely algorithm. Everyone hears the same stream at the same time, which creates urgency, energy, and shared moments of discovery as the next wave of talent breaks.',
      },
      {
        title: 'Community Voting - Up and Down',
        tag: 'Difference-maker',
        body: 'You do not just like music passively. You give real, honest feedback by voting songs up or down. Both directions count, so the strongest songs rise on merit and artists get the truth about where they stand. Every vote is a Ripple that carries an artist a little further.',
      },
      {
        title: 'The Yield - Earn for your ears',
        body: 'Prospectors can earn steady rewards from verified engagement. Refine songs, complete surveys, and leave structured feedback in The Refinery, and your contribution is recognized - real value for helping shape what the market hears next.',
      },
      {
        title: 'Direct-to-Fan Marketplace',
        body: 'Hear a 30-second preview of any track for free. When you find something you love, buy the full song to unlock full playback and downloads, and support the artist directly. No gatekeepers between you and the music.',
      },
    ],
  },
  {
    audience: 'For Gems (Artists)',
    tagline: 'Gain verified exposure, prove demand, and get paid directly.',
    features: [
      {
        title: 'Verified Listener Exposure',
        tag: 'Artist Discovery Placements',
        body: 'Seed a track into the Networx discovery pipeline for $1.99, with a target delivery of roughly 1,000 verified listener exposures. Placements are built around real, tracked delivery and engagement - not vanity numbers.',
      },
      {
        title: 'Sell Full Tracks Directly',
        body: 'Your artist page offers a free 30-second preview, and listeners purchase the full track for complete playback and downloads. You build real demand and earn directly from the fans who believe in you.',
      },
      {
        title: 'Artist Livestreaming + Live Sync Chat',
        body: 'Go live and meet your fans in real time. Broadcast straight from your device or through external software like OBS, while listeners chat with you in the room. We reject the "mysterious artist" enigma - if your song is playing, you should be there with your people.',
      },
      {
        title: 'The Refinery',
        body: 'A talent development and filtering layer where promising songs are refined, evaluated, and prepared for bigger opportunities. Get an in-depth read from verified reviewers across multiple dimensions before you break out.',
      },
      {
        title: 'The Wake - Transparent Analytics',
        body: 'Every Ripple leaves a path behind it. The Wake is your analytics report: reach, engagement, votes, downvotes, preview-to-purchase conversion, and growth over time - so each campaign is measurable.',
      },
    ],
  },
  {
    audience: 'For Catalysts (ProNetworx)',
    tagline: 'A creative marketplace where talent and opportunity meet.',
    features: [
      {
        title: 'The Creative Services Marketplace',
        body: 'ProNetworx connects hidden gems with experienced engineers, producers, photographers, videographers, designers, mentors, and stylists. Build a professional profile, list your services and price, and let buyers find you.',
      },
      {
        title: 'Profiles, Feed, Messaging, and the Job Board',
        body: 'A professional profile with portfolio, an Instagram-style feed, direct messaging, and a job board where members post requests and Catalysts apply. Find work, collaborate, and grow together.',
      },
      {
        title: 'Beyond Music - Any Creative Niche',
        body: 'ProNetworx is built to expand beyond music into any creative or service category where there is market demand - even niche skills such as custom knitting, set design, choreography, voice work, or consulting. If there is a market for it, it belongs here.',
      },
    ],
  },
];

const ROADMAP: Feature[] = [
  {
    title: 'Live Events',
    comingSoon: true,
    body: 'Showcases, artist battles, listening sessions, and ticketed events that bring the community together offline.',
  },
  {
    title: 'Brand Ambassadors / Founding 100',
    comingSoon: true,
    body: 'An ambassador program and a Founding 100 cohort of artists to spread Networx into new cities and scenes.',
  },
];

export default function FeaturesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 sm:py-24 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            One ecosystem. Every tool to be discovered.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Networx combines live radio, community voting, a direct-to-fan
            marketplace, livestreaming, talent development, and the ProNetworx
            creative marketplace into one people-powered platform. Here is
            everything it does.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="border-2 border-primary-foreground/90 shadow-md !text-black" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground/15" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Listening is free, forever - supported by light, non-intrusive ads, not listener fees.
          </p>
        </div>
      </section>

      {/* Feature groups by audience */}
      {GROUPS.map((group, idx) => (
        <section
          key={group.audience}
          className={idx % 2 === 1 ? 'py-16 bg-muted/30' : 'py-16'}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center sm:text-left">
              <h2 className="text-3xl font-bold text-foreground">{group.audience}</h2>
              <p className="text-muted-foreground mt-2 text-lg">{group.tagline}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.features.map((f) => (
                <Card key={f.title} className="h-full">
                  <CardContent className="pt-6">
                    {f.tag && (
                      <Badge variant="secondary" className="mb-3">
                        {f.tag}
                      </Badge>
                    )}
                    <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                    <p className="text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
                    {f.points && (
                      <ul className="list-disc pl-5 mt-3 space-y-1 text-sm text-muted-foreground">
                        {f.points.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Roadmap / Coming soon */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-foreground">On the roadmap</h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Building toward a community-powered label and creative economy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {ROADMAP.map((f) => (
              <Card key={f.title} className="h-full border-dashed">
                <CardContent className="pt-6">
                  <Badge className="mb-3">Coming soon</Badge>
                  <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground mt-2 leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" asChild>
              <Link href="/contact">Want in early? Get in touch</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* People-powered label vision + CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">The people-powered label</h2>
          <p className="mt-4 text-lg text-primary-foreground/90">
            Instead of executives alone deciding who gets a chance, Networx lets
            the audience help identify demand - giving artists a direct path from
            discovery to revenue. The mission is simple: no more wasted talent.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="border-2 border-primary-foreground/90 shadow-md !text-black" asChild>
              <Link href="/signup">Join the movement</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground/15" asChild>
              <Link href="/pro-networx">Explore ProNetworx</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
