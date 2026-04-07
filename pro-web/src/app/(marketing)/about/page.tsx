import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About - Pro Networx',
  description:
    'Pro Networx helps creators connect, collaborate, and grow together through a network-first platform.',
};

export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">About Pro Networx</h1>
      <p className="text-xl text-primary font-semibold mb-10">
        We build networks that turn talent into momentum.
      </p>

      <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Our Mission</h2>
        <p className="text-muted-foreground mb-6">
          Pro Networx exists to help people network and connect because we believe there is talent everywhere, but strength is in numbers.
          The more support you have, the better work you can do and the faster you can grow.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Our Belief</h2>
        <p className="text-muted-foreground mb-4">
          “If you want to go fast, go alone, but if you want to go far, go together.”
          We designed Pro Networx around that principle: community-first growth, practical collaboration, and shared wins.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Why This Matters</h2>
        <p className="text-muted-foreground mb-4">
          Many talented people lose confidence because they feel stuck in areas where they lack experience.
          Pro Networx helps close those gaps by making it easier to find collaborators who can cover your weaknesses while you play to your strengths.
        </p>
        <p className="text-muted-foreground mb-4">
          The result is simple: better work, more opportunities, and a stronger path to making your dreams real.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">What Pro Networx Delivers</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-3 mb-6">
          <li><strong className="text-foreground">Network-first discovery:</strong> find collaborators by skill, service, and availability.</li>
          <li><strong className="text-foreground">Real collaboration:</strong> connect creators, producers, engineers, designers, media teams, and strategists in one place.</li>
          <li><strong className="text-foreground">Confidence through community:</strong> build with people who complement your strengths.</li>
          <li><strong className="text-foreground">Growth with intention:</strong> make consistent progress with support, not isolation.</li>
        </ul>

        <Card className="mt-12 border-primary/30 bg-primary/5">
          <CardContent className="pt-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Build further, together</h3>
            <p className="text-muted-foreground mb-4">
              Join Pro Networx and connect with the people who help you move from potential to execution.
            </p>
            <Button asChild>
              <Link href="/signup">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
