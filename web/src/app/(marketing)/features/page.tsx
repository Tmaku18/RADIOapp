import { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import {
  MarketingHero,
  DimensionSection,
  DimensionCard,
  DimensionCtaPrimary,
  DimensionCtaOutline,
} from '@/components/marketing/MarketingHero';
import { Reveal } from '@/components/dimension/Reveal';

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
    audience: 'For Artists',
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
    audience: 'For Producers (ProNetworx)',
    tagline: 'A creative marketplace where talent and opportunity meet.',
    features: [
      {
        title: 'The Creative Services Marketplace',
        body: 'ProNetworx connects hidden gems with experienced engineers, producers, photographers, videographers, designers, mentors, and stylists. Build a professional profile, list your services and price, and let buyers find you.',
      },
      {
        title: 'Profiles, Feed, Messaging, and the Job Board',
        body: 'A professional profile with portfolio, an Instagram-style feed, direct messaging, and a job board where members post requests and Producers apply. Find work, collaborate, and grow together.',
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
      <MarketingHero
        sectionLabel="◤ CAPABILITIES"
        title={
          <>
            One ecosystem.
            <br />
            <span className="text-glow-cyan text-cyan-300">Every tool to be discovered.</span>
          </>
        }
        subtitle="Networx combines live radio, community voting, a direct-to-fan marketplace, livestreaming, talent development, and ProNetworx into one people-powered platform."
        footnote="Listening is free, forever — supported by light ads, not listener fees."
      >
        <DimensionCtaPrimary href="/signup">Get Started Free</DimensionCtaPrimary>
        <DimensionCtaOutline href="/pricing">See pricing</DimensionCtaOutline>
      </MarketingHero>

      {GROUPS.map((group, idx) => (
        <DimensionSection key={group.audience} className={idx % 2 === 1 ? 'border-y border-white/5' : ''}>
          <Reveal>
            <div className="mb-10 text-center sm:text-left">
              <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-2">
                ◤ {group.audience.toUpperCase()}
              </div>
              <h2 className="font-unbounded font-black text-3xl text-white">{group.audience}</h2>
              <p className="text-white/60 mt-2 text-lg">{group.tagline}</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {group.features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <DimensionCard>
                  {f.tag && (
                    <Badge variant="secondary" className="mb-3 bg-cyan-400/10 text-cyan-300 border-cyan-400/30">
                      {f.tag}
                    </Badge>
                  )}
                  <h3 className="font-unbounded font-bold text-lg text-white">{f.title}</h3>
                  <p className="text-white/60 mt-2 leading-relaxed text-sm">{f.body}</p>
                </DimensionCard>
              </Reveal>
            ))}
          </div>
        </DimensionSection>
      ))}

      <DimensionSection className="border-t border-white/5">
        <Reveal>
          <div className="mb-10 text-center">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400 mb-2">
              ◤ ROADMAP
            </div>
            <h2 className="font-unbounded font-black text-3xl text-white">On the horizon</h2>
            <p className="text-white/60 mt-2 text-lg">
              Building toward a community-powered label and creative economy.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {ROADMAP.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.1}>
              <DimensionCard className="border-dashed border-white/15">
                <Badge className="mb-3 bg-pink-500/20 text-pink-300 border-pink-400/30">Coming soon</Badge>
                <h3 className="font-unbounded font-bold text-lg text-white">{f.title}</h3>
                <p className="text-white/60 mt-2 leading-relaxed text-sm">{f.body}</p>
              </DimensionCard>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 text-center">
          <DimensionCtaOutline href="/contact">Want in early? Get in touch</DimensionCtaOutline>
        </div>
      </DimensionSection>

      <section className="relative overflow-hidden py-20 border-t border-white/10">
        <div className="absolute inset-0 cyber-grid opacity-20" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-10 text-center">
          <Reveal>
            <h2 className="font-unbounded font-black text-3xl sm:text-4xl text-white">
              The people-powered label
            </h2>
            <p className="mt-4 text-lg text-white/70 leading-relaxed">
              Instead of executives alone deciding who gets a chance, Networx lets the audience help
              identify demand — giving artists a direct path from discovery to revenue.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <DimensionCtaPrimary href="/signup">Join the movement</DimensionCtaPrimary>
              <DimensionCtaOutline href="/pro-networx">Explore ProNetworx</DimensionCtaOutline>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
