import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Pricing - RadioApp',
  description: 'Simple, transparent pricing for gems. Listeners always free.',
};

export const revalidate = 3600;

const creditPackages = [
  {
    credits: 10,
    price: 9.99,
    popular: false,
    description: 'Perfect for testing the waters',
  },
  {
    credits: 25,
    price: 19.99,
    popular: false,
    description: 'Great for single releases',
  },
  {
    credits: 50,
    price: 34.99,
    popular: true,
    description: 'Best value for regular promotion',
  },
  {
    credits: 100,
    price: 59.99,
    popular: false,
    description: 'For serious campaigns',
  },
];

export default function PricingPage() {
  return (
    <div className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            Listening is always free. Gems pay only for promotion.
          </p>
        </div>

        {/* Listener Section */}
        <div className="mb-20">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <h2 className="text-2xl font-bold mb-4">For Listeners</h2>
              <div className="text-5xl font-bold mb-2">Free</div>
              <p className="text-primary-foreground/80 mb-6">Forever. No ads. No limits.</p>
              <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Unlimited streaming
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Like and save tracks
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Follow gems
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Web and mobile access
                </li>
              </ul>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/signup?role=listener">Start Listening</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Gems Section */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            For Gems - Play Credits
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Credits are used to promote your tracks in our radio rotation. 
            One credit = one play to a real listener. No bots, no fake streams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creditPackages.map((pkg) => (
              <Card
                key={pkg.credits}
                className={pkg.popular ? 'relative ring-2 ring-primary' : ''}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge>MOST POPULAR</Badge>
                  </div>
                )}
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl font-bold text-foreground mb-1">{pkg.credits}</div>
                  <div className="text-sm text-muted-foreground mb-4">credits</div>
                  <div className="text-3xl font-bold text-foreground mb-2">${pkg.price}</div>
                  <div className="text-sm text-muted-foreground mb-6">
                    ${(pkg.price / pkg.credits).toFixed(2)} per credit
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">{pkg.description}</p>
                  <Button className="w-full" variant={pkg.popular ? 'default' : 'secondary'} asChild>
                    <Link href="/signup?role=artist">Get Started</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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
    </div>
  );
}
