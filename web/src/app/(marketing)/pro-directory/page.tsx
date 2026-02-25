import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Pro-Directory and ProNetworx | Networx',
  description: 'Join Networx Pro-Directory and ProNetworx to mentor hidden gems, showcase your portfolio, and connect with artists who need your expertise.',
};

export const revalidate = 3600;
const PRO_NETWORX_URL = process.env.NEXT_PUBLIC_PRO_NETWORX_URL || 'http://localhost:3002';

export default function ProDirectoryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">Industry Catalysts and ProNetworx</h1>
      <p className="text-xl text-primary font-semibold mb-10">
        The signal needs a spark. Become an Industry Catalyst and help artists scale.
      </p>

      <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">The 4 AM Story</h2>
        <p className="text-muted-foreground mb-4">
          Most tech companies start in a Silicon Valley garage. Networx started at a gas station at 4 AM. That was where two founders first crossed paths—a &quot;butterfly effect&quot; in its purest form. We built Networx to make those 4 AM moments happen for everyone.
        </p>
        <p className="text-muted-foreground mb-6">
          As an <strong className="text-foreground">Industry Catalyst</strong>, you are that bridge. You are the photographer, producer, engineer, marketer, or strategist who helps hidden gems become inevitable. You get visibility in our Pro-Directory and ProNetworx pathways, a direct line to artists who need your craft, and 100% of what you charge.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">What You Get</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-6">
          <li>A professional profile with portfolio gallery, service menu, and location</li>
          <li>Direct messages from artists—no middleman</li>
          <li>Optional Mentor badge: signal that you&apos;re open to guiding up-and-coming talent</li>
          <li>Discovery by service type, location, and price—artists find you when they need you</li>
        </ul>

        <Card className="mt-12 border-primary/30 bg-primary/5">
          <CardContent className="pt-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Join the Pro-Directory for free</h3>
            <p className="text-muted-foreground mb-6">
              Build your portfolio, mentor hidden gems, and get paid direct. Join the directory in Networx and use ProNetworx to deepen collaboration.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/signup">Create account</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/discover">Browse Catalysts</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={PRO_NETWORX_URL} target="_blank" rel="noreferrer">
                  Open ProNetworx
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
