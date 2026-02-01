import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'FAQ - RadioApp',
  description: 'Frequently asked questions about RadioApp.',
};

export const revalidate = 3600;

const faqs = [
  {
    category: 'General',
    questions: [
      {
        q: 'What is RadioApp?',
        a: 'RadioApp is a radio-style streaming platform that helps underground artists get discovered. Artists can upload music and promote it through our play credit system, while listeners enjoy a continuous stream of curated music.',
      },
      {
        q: 'Is RadioApp free to use?',
        a: 'Yes! Listening is completely free, forever. Artists can upload music for free, and only pay if they want to promote their tracks through our credit system.',
      },
      {
        q: 'How is this different from Spotify or SoundCloud?',
        a: 'Unlike algorithm-driven platforms, RadioApp operates like a traditional radio station. Everyone hears the same stream, creating shared discovery moments. Our promotion system is transparent - credits directly boost your plays.',
      },
    ],
  },
  {
    category: 'For Artists',
    questions: [
      {
        q: 'How do I upload my music?',
        a: 'Create an artist account, go to your dashboard, and click "Upload". Submit your track with artwork for review. Once approved by our moderation team, it enters the radio rotation.',
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
        a: 'Yes! Your artist dashboard shows detailed analytics including total plays, engagement metrics, credits spent, and listener activity over time.',
      },
    ],
  },
  {
    category: 'For Listeners',
    questions: [
      {
        q: 'Do I need an account to listen?',
        a: 'You can listen without an account, but creating a free account lets you like tracks, follow artists, and access the mobile app.',
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

      <div className="space-y-12">
        {faqs.map((section) => (
          <div key={section.category}>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {section.category}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {section.questions.map((faq, index) => (
                <AccordionItem key={index} value={`${section.category}-${index}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">{faq.a}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
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
