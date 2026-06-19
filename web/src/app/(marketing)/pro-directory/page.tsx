import { Metadata } from 'next';
import {
  MarketingHero,
  DimensionSection,
  DimensionCard,
  DimensionCtaPrimary,
  DimensionCtaOutline,
} from '@/components/marketing/MarketingHero';
import { Reveal } from '@/components/dimension/Reveal';
import { getProNetworxAppUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Pro-Directory and ProNetworx | Networx',
  description:
    'Join Networx Pro-Directory and ProNetworx to mentor hidden gems, showcase your portfolio, and connect with artists who need your expertise.',
  alternates: { canonical: '/pro-directory' },
};

export const revalidate = 3600;

export default function ProDirectoryPage() {
  const proNetworxDirectory = `${getProNetworxAppUrl()}/pro-networx/directory`;
  return (
    <div>
      <MarketingHero
        sectionLabel="◤ CATALYSTS"
        title={
          <>
            Industry <span className="text-glow-pink text-pink-400">Catalysts</span>
            <br />
            &amp; ProNetworx
          </>
        }
        subtitle="The signal needs a spark. Become an Industry Catalyst and help artists scale."
      />

      <DimensionSection>
        <Reveal>
          <div className="font-dim-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-3">
            ◤ THE 4 AM STORY
          </div>
          <h2 className="font-unbounded font-black text-3xl text-white mb-4">The bridge</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            Most tech companies start in a Silicon Valley garage. Networx started at a gas station at
            4 AM — a butterfly effect in its purest form. We built Networx to make those moments
            happen for everyone.
          </p>
          <p className="text-white/70 leading-relaxed mb-8">
            As an <strong className="text-white">Industry Catalyst</strong>, you are that bridge:
            photographer, producer, engineer, marketer, or strategist who helps hidden gems become
            inevitable. Visibility in Pro-Directory and ProNetworx, a direct line to artists, and
            100% of what you charge.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <DimensionCard className="mb-8">
            <h2 className="font-unbounded font-bold text-xl text-white mb-4">What you get</h2>
            <ul className="space-y-3 text-white/70 text-sm">
              {[
                'Professional profile with portfolio gallery, service menu, and location',
                'Direct messages from artists — no middleman',
                'Optional Mentor badge for guiding up-and-coming talent',
                'Discovery by service type, location, and price',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </DimensionCard>
        </Reveal>

        <Reveal delay={0.15}>
          <DimensionCard highlight className="text-center">
            <h3 className="font-unbounded font-black text-xl text-white mb-4">
              Join the Pro-Directory for free
            </h3>
            <p className="text-white/60 mb-6 max-w-xl mx-auto text-sm">
              Build your portfolio, mentor hidden gems, and get paid direct. Join in Networx and use
              ProNetworx to deepen collaboration.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <DimensionCtaPrimary href="/signup">Create account</DimensionCtaPrimary>
              <DimensionCtaOutline href={proNetworxDirectory}>Browse Catalysts</DimensionCtaOutline>
              <DimensionCtaOutline href={proNetworxDirectory}>Open ProNetworx</DimensionCtaOutline>
            </div>
          </DimensionCard>
        </Reveal>
      </DimensionSection>
    </div>
  );
}
