import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'FAQ - Networx',
  description: 'Frequently asked questions about Networx: democratic radio, Pro-Network, and By Artists, For Artists.',
};

export const revalidate = 3600;

const faqs = [
  {
    category: 'General',
    questions: [
      {
        q: 'What is Networx?',
        a: 'Networx is a "By Artists, For Artists" live radio, music discovery, and creative marketplace. It combines democratic radio, artist livestreams, live chat, community up/down voting, direct-to-fan song sales, and the ProNetworx growth hub - so listeners discover and engage in real time while artists prove demand and get paid. We exist so no talent goes undiscovered.',
      },
      {
        q: 'Is Networx free to use?',
        a: 'Yes! Listening is free for everyone, and it always will be. Networx stays free through light, non-intrusive ads plus artist promotions and marketplace sales—not listener fees. Artists can upload music for free and only pay if they want verified exposure through a discovery placement.',
      },
      {
        q: 'How is this different from Spotify or SoundCloud?',
        a: 'Networx operates like real radio: everyone hears the same stream, creating shared discovery moments. We add community up/down voting, Live Sync Chat so artists can be in the room with fans, a direct-to-fan marketplace, and a Pro-Network for mentorship. Our charts are earned, not bought.',
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
        q: 'Can I vote songs down, not just up?',
        a: 'Yes - and that is the difference-maker. You can vote songs up or down. Both directions count, giving artists honest feedback and helping the strongest songs rise on merit.',
      },
      {
        q: 'How do I buy a song?',
        a: 'Every track has a free 30-second preview. When you find one you love, purchase the full song to unlock complete playback and downloads. No subscription needed - hear it, love it, own it.',
      },
      {
        q: 'Can I earn as a listener?',
        a: 'Yes. Through The Yield, Prospectors can earn rewards from verified engagement - refining songs, completing surveys, and leaving structured feedback in The Refinery. Your ears help shape what the market hears next.',
      },
      {
        q: 'Can I skip songs?',
        a: 'Yes, you can skip to the next track at any time. However, since this is a radio-style experience, you cannot go back to previous songs.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'Yes! RadioApp is available on iOS and Android. Download it from the App Store or Google Play.',
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">
        Frequently Asked Questions
      </h1>
      <p className="text-xl text-muted-foreground mb-12">
        Everything you need to know about RadioApp.
      </p>

      <div className="space-y-6">
        {faqs.map((section) => (
          <Card key={section.category}>
            <CardHeader>
              <CardTitle className="text-2xl">{section.category}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion
                type="single"
                collapsible
                className="w-full border-0 rounded-xl bg-transparent shadow-none"
              >
                {section.questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${section.category}-${index}`}
                    className="border-border"
                  >
                    <AccordionTrigger className="text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground">{faq.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-16">
        <CardContent className="pt-8 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Still have questions?
          </h3>
          <p className="text-muted-foreground mb-4">
            We&apos;re here to help. Reach out to our support team.
          </p>
          <Button asChild>
            <Link href="/contact">Contact Us</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
