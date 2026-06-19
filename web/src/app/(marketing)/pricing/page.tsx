import { Metadata } from 'next';
import Link from 'next/link';
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
  title: 'Pricing - Networx',
  description:
    'Simple, transparent Networx pricing: free listening for everyone, $1.99 verified-exposure discovery placements for artists, direct-to-fan song sales, The Refinery, and ProNetworx.',
};

export const revalidate = 3600;

export default function PricingPage() {
  return (
    <div>
      <MarketingHero
        sectionLabel="◤ PRICING"
        title={
          <>
            Simple, <span className="text-glow-cyan text-cyan-300">transparent</span> pricing
          </>
        }
        subtitle="Listening is free for everyone, forever. Artists pay only when they want verified exposure, and fans pay only for the full songs they choose to own."
      />

      <DimensionSection>
        <Reveal>
          <DimensionCard highlight className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-unbounded font-black text-2xl text-white mb-2">For Everyone</h2>
            <div className="font-unbounded font-black text-5xl text-cyan-300 mb-2">Free</div>
            <p className="text-white/60 mb-6 max-w-lg mx-auto">
              Listen, discover, upload, and use the job board. Free forever — supported by light,
              non-intrusive ads, not listener fees.
            </p>
            <ul className="text-left max-w-md mx-auto space-y-3 mb-8 text-white/70 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Unlimited streaming
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Send ripples and votes during live discovery
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Upload music and use the job board
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Artist livestream viewing and chat access
              </li>
            </ul>
            <DimensionCtaPrimary href="/signup">Sign up</DimensionCtaPrimary>
          </DimensionCard>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="text-center mb-10">
            <h2 className="font-unbounded font-black text-2xl text-white mb-3">
              Artist Discovery Placements
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Seed your track into the Networx discovery pipeline. No bots — just real delivery you
              can measure.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <DimensionCard highlight className="max-w-xl mx-auto text-center relative">
            <Badge className="mb-4 bg-cyan-400/20 text-cyan-300 border-cyan-400/30">
              VERIFIED EXPOSURE
            </Badge>
            <div className="font-unbounded font-black text-5xl text-white mb-2">$1.99</div>
            <div className="text-white/50 font-dim-mono text-sm mb-6 tracking-wider">
              PER TRACK PLACEMENT
            </div>
            <ul className="text-left max-w-sm mx-auto space-y-3 mb-8 text-white/70 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">✓</span> ~1,000 verified listener exposures
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">✓</span> Tracked delivery and engagement
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">✓</span> Community votes and honest feedback
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400">✓</span> Full campaign analytics in The Wake
              </li>
            </ul>
            <DimensionCtaPrimary href="/login?redirect=/artist/songs">Promote a track</DimensionCtaPrimary>
          </DimensionCard>
        </Reveal>

        <div className="mt-12 space-y-6 max-w-3xl mx-auto">
          {[
            {
              title: 'Direct-to-Fan Song Sales',
              body: 'Every track offers a free 30-second preview. Fans purchase the full song to unlock complete playback and downloads. Pricing is set per track — no subscription required.',
            },
            {
              title: 'The Refinery Review — $4.99 per song',
              body: 'In-depth review from at least 100 verified reviewers across 7 dimensions plus a 12-question survey. Real-time analytics with mean, median, and every individual review.',
              cta: { href: '/login?redirect=/artist/songs', label: 'Submit to The Refinery' },
              cta2: { href: '/refinery', label: 'Sign up as reviewer' },
            },
            {
              title: 'ProNetworx Access',
              body: 'Connect with Catalysts — producers, photographers, mentors — who help artists build momentum beyond plays.',
              cta: { href: '/pro-networx', label: 'Open ProNetworx' },
            },
          ].map((block, i) => (
            <Reveal key={block.title} delay={0.1 + i * 0.05}>
              <DimensionCard>
                <h3 className="font-unbounded font-bold text-xl text-white mb-3">{block.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-4">{block.body}</p>
                {'cta' in block && block.cta && (
                  <div className="flex flex-wrap gap-3">
                    <DimensionCtaPrimary href={block.cta.href}>{block.cta.label}</DimensionCtaPrimary>
                    {'cta2' in block && block.cta2 && (
                      <DimensionCtaOutline href={block.cta2.href}>{block.cta2.label}</DimensionCtaOutline>
                    )}
                  </div>
                )}
              </DimensionCard>
            </Reveal>
          ))}

          <Reveal delay={0.3}>
            <DimensionCard className="border-dashed border-white/15 text-center">
              <Badge className="mb-3 bg-pink-500/20 text-pink-300">Coming soon</Badge>
              <h3 className="font-unbounded font-bold text-xl text-white mb-2">
                Live Events &amp; Sponsorships
              </h3>
              <p className="text-white/60 text-sm">
                Showcases, artist battles, and ticketed events on the roadmap. Listening stays free.
              </p>
            </DimensionCard>
          </Reveal>
        </div>

        <p className="text-center mt-12 text-white/50">
          Have questions?{' '}
          <Link href="/faq" className="text-cyan-300 hover:text-white font-medium">
            Check our FAQ
          </Link>
        </p>
      </DimensionSection>
    </div>
  );
}
