import { Metadata } from 'next';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  MarketingHero,
  DimensionSection,
  DimensionCard,
  DimensionCtaPrimary,
  DimensionCtaOutline,
} from '@/components/marketing/MarketingHero';
import { Reveal } from '@/components/dimension/Reveal';

export const metadata: Metadata = {
  title: 'FAQ - Networx',
  description:
    'Frequently asked questions about Networx: democratic radio, artist livestreams, ProNetworx mentorship, and a by-artists-for-artists ecosystem.',
};

export const revalidate = 3600;
const SUPPORT_DISCORD_URL = 'https://discord.gg/a9S5m8fUJy';

const faqs = [
  {
    category: 'General',
    questions: [
      {
        q: 'What is Networx?',
        a: 'Networx is a "By Artists, For Artists" music discovery marketplace and creative networking platform. It combines radio-style shared listening, artist livestreams, live chat, community up/down voting, direct-to-fan song sales, and the ProNetworx growth hub - so listeners discover and engage in real time while artists prove demand and get paid.',
      },
      {
        q: 'Is Networx free to use?',
        a: 'Yes! Listening is free for everyone, and it always will be. Networx stays free through light, non-intrusive ads plus artist promotions and marketplace sales—not listener fees. Artists can upload music for free and only pay if they want verified exposure through a discovery placement.',
      },
      {
        q: 'How is this different from Spotify or SoundCloud?',
        a: 'Networx works like radio-style shared listening: everyone hears the same stream, creating shared discovery moments. We add community up/down voting, artist livestreams, Live Sync Chat, a direct-to-fan marketplace, and ProNetworx mentorship pathways so careers can grow beyond streams. Our community rankings are earned, not bought.',
      },
      {
        q: 'What are Live Events?',
        a: 'Coming soon: showcases, artist battles, listening sessions, and ticketed events that bring the community together offline. They are on our roadmap as Networx grows into a community-powered creative movement.',
      },
    ],
  },
  {
    category: 'For Gems',
    questions: [
      {
        q: 'How do I upload my music?',
        a: 'Create a gem account, go to your dashboard, and click "Upload". Submit your track with artwork for review. Once approved by our moderation team, it enters the radio rotation.',
      },
      {
        q: 'How do artist discovery placements work?',
        a: 'Seed a track into the Networx discovery pipeline for $1.99, with a target delivery of roughly 1,000 verified listener exposures. Placements are built on real, tracked delivery and engagement - and you get full campaign analytics (votes, downvotes, and conversion) in The Wake. No bots, no fake streams.',
      },
      {
        q: 'Can I sell my music on Networx?',
        a: 'Yes. Your artist page offers a free 30-second preview, and listeners buy the full track to unlock complete playback and downloads. You build real demand and earn directly from your fans.',
      },
      {
        q: 'Can I livestream to my fans?',
        a: 'Yes. Artists and DJs can broadcast live - straight from your device or through external software like OBS - while fans join the room and chat with you in real time through Live Sync Chat.',
      },
      {
        q: 'How long does moderation take?',
        a: 'Most tracks are reviewed within 24-48 hours. We check for audio quality, appropriate content, and ensure you have rights to the music.',
      },
      {
        q: 'Do my tracks still get plays without a placement?',
        a: 'Yes. Your music stays in the rotation and still earns organic plays based on engagement and our fairness algorithm. A discovery placement just adds verified exposure on top.',
      },
      {
        q: 'Can I see analytics for my tracks?',
        a: 'Yes! The Wake (in your gem dashboard) shows detailed analytics including discoveries, engagement metrics, votes and downvotes, placement delivery, preview-to-purchase conversion, and Prospector activity over time.',
      },
      {
        q: 'What is ProNetworx and why should I use it?',
        a: 'ProNetworx is the professional growth layer connected to Networx. It helps artists find Catalysts (service providers), collaborators, and mentors who can support release strategy, production quality, visual branding, and career development.',
      },
    ],
  },
  {
    category: 'For Prospectors',
    questions: [
      {
        q: 'Do I need an account to listen?',
        a: 'You can listen without an account, but creating a free account lets you send ripples to tracks, follow gems, and access the mobile app.',
      },
      {
        q: 'What is a Ripple?',
        a: 'A Ripple is your vote or like on a track. Every Ripple carries an artist\'s sound a little further across the network — the Butterfly Effect in action.',
      },
      {
        q: 'What is The Yield?',
        a: 'The Yield is your rewards as a Prospector — steady earnings from verified engagement like refinement, surveys, and feedback in The Refinery.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'Yes. Networx supports mobile listening and engagement on iOS and Android so you can discover, vote, and follow artists on the go.',
      },
      {
        q: 'Why do I hear the same song as everyone else?',
        a: "That's the magic of radio! Unlike personal playlists, everyone hears the same stream. It creates shared moments of discovery and community.",
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What audio formats are supported?',
        a: 'We accept MP3, WAV, M4A, AAC, OGG, FLAC, and WebM files up to 100MB. For best quality, upload lossless WAV or FLAC files.',
      },
      {
        q: 'Is my payment information secure?',
        a: 'Absolutely. We use Stripe for payment processing, which is PCI-DSS compliant. We never store your card details on our servers.',
      },
      {
        q: 'How do you prevent fake plays?',
        a: 'We use a heartbeat verification system that requires continuous connection during playback. Bot scripts and automated tools cannot generate valid plays.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div>
      <MarketingHero
        sectionLabel="◤ SUPPORT"
        title={
          <>
            Frequently asked <span className="text-glow-pink text-pink-400">questions</span>
          </>
        }
        subtitle="Everything you need to know about Networx and ProNetworx."
      />

      <DimensionSection>
        <div className="space-y-6 max-w-4xl mx-auto">
          {faqs.map((section, si) => (
            <Reveal key={section.category} delay={si * 0.05}>
              <DimensionCard>
                <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                  ◤ {section.category.toUpperCase()}
                </div>
                <h2 className="font-unbounded font-black text-2xl text-white mb-4">
                  {section.category}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {section.questions.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`${section.category}-${index}`}
                      className="border-white/10"
                    >
                      <AccordionTrigger className="text-left text-white hover:text-cyan-300 hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-white/60 leading-relaxed">{faq.a}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </DimensionCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <DimensionCard className="mt-12 text-center max-w-2xl mx-auto">
            <h3 className="font-unbounded font-bold text-xl text-white mb-2">Still have questions?</h3>
            <p className="text-white/60 mb-6">We&apos;re here to help. Reach out to our support team.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <DimensionCtaPrimary href="/contact">Contact Us</DimensionCtaPrimary>
              <DimensionCtaOutline href={SUPPORT_DISCORD_URL} external>
                Join Support Discord
              </DimensionCtaOutline>
              <DimensionCtaOutline href="/pro-networx">Explore ProNetworx</DimensionCtaOutline>
            </div>
          </DimensionCard>
        </Reveal>
      </DimensionSection>
    </div>
  );
}
