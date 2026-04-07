import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Pricing - Pro Networx',
  description:
    'Simple pricing for creators and collaborators on Pro Networx.',
};

export const revalidate = 3600;

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    popular: false,
    description: 'Great for exploring the network and setting up your public profile.',
    features: ['Browse directory', 'Public profile', 'Basic discovery access'],
  },
  {
    name: 'Creator Network',
    price: '$7.99/mo',
    popular: true,
    description: 'For active collaborators who want to network, message, and convert opportunities faster.',
    features: [
      'Everything in Starter',
      'Messaging access',
      'Priority profile visibility',
      'Expanded collaboration tools',
    ],
  },
  {
    name: 'Team / Studio',
    price: 'Contact Sales',
    popular: false,
    description: 'For collectives, studios, and agencies onboarding multiple collaborators.',
    features: ['Multi-user workflows', 'Custom onboarding support', 'Team-level growth strategy'],
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
            Pricing built for connection, collaboration, and long-term growth.
          </p>
        </div>

        {/* Why pricing exists */}
        <div className="mb-20">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Why we price this way</h2>
              <div className="text-3xl font-bold mb-2">Community-first access</div>
              <p className="text-primary-foreground/80 mb-6">
                We keep entry simple so creators can start quickly, then scale into tools that help them collaborate better and grow faster.
              </p>
              <ul className="text-left max-w-md mx-auto space-y-3 mb-8">
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Start free
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Upgrade only when you need more leverage
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Keep focus on outcomes, not complexity
                </li>
                <li className="flex items-center">
                  <span className="mr-2">✓</span>
                  Designed to help people go further together
                </li>
              </ul>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Plans for every stage
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Whether you are just getting started or building a full team, Pro Networx gives you a clear path to connect and execute.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((pkg) => (
              <Card
                key={pkg.name}
                className={pkg.popular ? 'relative ring-2 ring-primary' : ''}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge>MOST POPULAR</Badge>
                  </div>
                )}
                <CardContent className="pt-6 text-center">
                  <div className="text-lg font-semibold text-foreground mb-1">{pkg.name}</div>
                  <div className="text-3xl font-bold text-foreground mb-4">{pkg.price}</div>
                  <p className="text-sm text-muted-foreground mb-6">{pkg.description}</p>
                  <ul className="text-left text-sm text-muted-foreground mb-6 space-y-2">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={pkg.popular ? 'default' : 'secondary'} asChild>
                    <Link href="/signup">Get Started</Link>
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
