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
        a: 'Networx is a "By Artists, For Artists" ecosystem that combines democratic radio with a Pro-Network hub. We help hidden gems get heard: artists upload and promote through our play credit system, while listeners enjoy a continuous stream and live chat. We exist so no talent goes undiscovered.',
      },
      {
        q: 'Is Networx free to use?',
        a: 'Yes! Listening is completely free, forever—no intrusive ads. Artists can upload music for free and only pay if they want to promote tracks through our credit system.',
      },
      {
        q: 'How is this different from Spotify or SoundCloud?',
        a: 'Networx operates like real radio: everyone hears the same stream, creating shared discovery moments. We add Live Sync Chat so artists can be in the room with fans, and a Pro-Network for mentorship. Our charts are earned, not bought.',
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
        q: 'What are play credits?',
        a: 'Play credits are used to promote your tracks in our rotation. One credit equals one play to a real listener. You can purchase credits in packages from $9.99 to $59.99.',
      },
      {
        q: 'How long does moderation take?',
        a: 'Most tracks are reviewed within 24-48 hours. We check for audio quality, appropriate content, and ensure you have rights to the music.',
      },
      {
        q: 'What happens when I run out of credits?',
        a: 'Your music stays in the rotation! Tracks without credits still get organic plays based on engagement and our fairness algorithm. Credits just boost your priority.',
      },
      {
        q: 'Can I see analytics for my tracks?',
        a: 'Yes! The Wake (in your gem dashboard) shows detailed analytics including discoveries, engagement metrics, credits spent, and Prospector activity over time.',
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
        q: "Can I skip ore's?",
        a: "Yes, you can skip to the next track at any time. However, since this is a radio-style experience, you cannot go back to previous ore's.",
      },
      {
        q: 'Is there a mobile app?',
        a: 'Yes! RadioApp is available on iOS and Android. Download it from the App Store or Google Play.',
      },
      {
        q: 'Why do I hear the same ore as everyone else?',
        a: "That's the magic of radio! Unlike personal playlists, everyone hears the same stream. It creates shared moments of discovery and community.",
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What audio formats are supported?',
        a: 'We accept MP3, WAV, M4A, AAC, OGG, FLAC, and WebM files up to 50MB. For best quality, upload lossless WAV or FLAC files.',
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
