import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingHero, MarketingBodyPattern } from '@/components/marketing/MarketingHero';

export const metadata: Metadata = {
  title: 'Pricing - Networx',
  description: 'Simple, transparent Networx pricing: free listening for everyone, $1.99 verified-exposure discovery placements for artists, direct-to-fan song sales, The Refinery, and ProNetworx.',
};

export const revalidate = 3600;

export default function PricingPage() {
  return (
    <div>
      <MarketingHero
        title="Simple, Transparent Pricing"
        subtitle="Listening is free for everyone, forever. Artists pay only when they want verified exposure, and fans pay only for the full songs they choose to own."
      />

      <section className="relative overflow-hidden py-16">
        <MarketingBodyPattern />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Free for everyone */}
        <div className="mb-20">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <h2 className="text-2xl font-bold mb-4">For Everyone</h2>
              <div className="text-5xl font-bold mb-2">Free</div>
              <p className="text-primary-foreground/80 mb-6">Listen, discover, upload, and use the job board. Free forever&mdash;supported by light, non-intrusive ads, not listener fees. No hidden limits.</p>
              <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Unlimited streaming
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Send ripples and votes during live discovery
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Upload music and use the job board
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Artist livestream viewing and chat access
                </li>
              </ul>
              <Button variant="outline" size="lg" asChild className="border-2 border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link href="/signup">Sign up</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Artist Discovery Placements */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-3">
            Artist Discovery Placements
          </h2>
          <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
            Want verified exposure? Seed your track into the Networx discovery pipeline.
            No bots and no fake streams - just real delivery you can measure, and your
            tracks still earn organic plays on top.
          </p>

          <div className="max-w-xl mx-auto">
            <Card className="relative ring-2 ring-primary">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge>VERIFIED EXPOSURE</Badge>
              </div>
              <CardContent className="pt-8 text-center">
                <div className="text-5xl font-bold text-foreground mb-2">$1.99</div>
                <div className="text-muted-foreground mb-6">per track placement</div>
                <ul className="text-left max-w-sm mx-auto space-y-3 mb-8">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    Target delivery of ~1,000 verified listener exposures
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    Tracked delivery and engagement, not vanity numbers
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    Community votes and downvotes for honest feedback
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    Full campaign analytics in The Wake
                  </li>
                </ul>
                <Button size="lg" asChild>
                  <Link href="/login?redirect=/artist/songs">Promote a track</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Direct-to-fan marketplace */}
        <div className="mt-16">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-8 text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-3">
                Direct-to-Fan Song Sales
              </h2>
              <p className="text-muted-foreground mb-3 max-w-2xl mx-auto">
                Every track offers a free 30-second preview. Fans purchase the full
                song to unlock complete playback and downloads - and artists earn
                directly from the people who believe in them. Pricing is set per track.
              </p>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                No subscription required to buy. Hear it, love it, own it.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-8 text-center">
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                The Refinery Review —{' '}
                <span className="text-muted-foreground line-through">$9.99</span>{' '}
                <span className="text-primary">$4.99</span> per song
              </h3>
              <p className="text-muted-foreground mb-3 max-w-2xl mx-auto">
                Get an in-depth review of your track from <strong>at least 100 verified
                reviewers</strong>. Every reviewer rates your song on 7 different dimensions
                (1-10) plus answers a 12-question survey, and you can add up to 10 of
                your own custom questions.
              </p>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                You see real-time analytics — mean and median scores, response
                distributions, flagged outliers, and every individual review.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button size="lg" asChild>
                  <Link href="/login?redirect=/artist/songs">
                    Submit a song to The Refinery
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/refinery">Sign up as a reviewer</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-8 text-center">
              <h3 className="text-2xl font-semibold text-foreground mb-3">ProNetworx Access</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Need collaborators, producers, photographers, or mentors? ProNetworx helps artists connect with trusted professionals and build momentum beyond plays.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" size="lg" asChild>
                  <Link href="/login?redirect=/pro-networx/directory">Become a Catalyst on ProNetworx</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/pro-networx">Open ProNetworx</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card className="border-dashed">
            <CardContent className="pt-8 text-center">
              <Badge className="mb-3">Coming soon</Badge>
              <h3 className="text-2xl font-semibold text-foreground mb-3">Live Events &amp; Sponsorships</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Showcases, artist battles, listening sessions, and ticketed events are
                on the roadmap, along with brand sponsorships and partnerships. Listening
                stays free, supported by light, non-intrusive ads.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Link */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground">
            Have questions?{' '}
            <Link href="/faq" className="text-primary hover:underline font-medium">
              Check our FAQ
            </Link>
          </p>
        </div>
        </div>
      </section>
    </div>
  );
}
