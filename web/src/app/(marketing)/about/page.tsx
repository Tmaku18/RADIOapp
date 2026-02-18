import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About - Networx',
  description: 'Networx: Where the People have the Voice, and the Artist has the Power. By Artists, For Artists—democratizing discovery so no hidden gem goes undiscovered.',
};

export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-4">About Networx</h1>
      <p className="text-xl text-primary font-semibold mb-10">
        Where the People have the Voice, and the Artist has the Power.
      </p>

      <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Our Mission</h2>
        <p className="text-muted-foreground mb-6">
          To maximize the frequency of &quot;Butterfly Effects&quot; by democratizing discovery. We exist to ensure that no &quot;hidden gem&quot; goes undiscovered and that talent is never sacrificed at the altar of lack of opportunity.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Our Story: The 4 AM Catalyst</h2>
        <p className="text-muted-foreground mb-4">
          Most tech companies start in a Silicon Valley garage. Networx started at a gas station at 4 AM.
        </p>
        <p className="text-muted-foreground mb-4">
          That was where Tanaka and Marquese first crossed paths. It was a random connection—a &quot;butterfly effect&quot; in its purest form. We were two people who, on paper, were struggling financially, but in reality, were rich in skills and belief. As our friendship grew, we saw each other&apos;s strengths: Tanaka, the architect with the technical vision to build the impossible; Marquese, the strategist with the heart to find the talent others overlooked.
        </p>
        <p className="text-muted-foreground mb-6">
          We realized that our meeting shouldn&apos;t have been a fluke. We pushed each other to succeed when the world wasn&apos;t looking. We realized that society is full of &quot;bright lights&quot; that are allowed to die out simply because they didn&apos;t have a bridge to the right room. We decided that allowing talent to go to waste is more than a shame—it is a crime. We built Networx to make those 4 AM moments happen for everyone.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">The Bridge from Invisible to Inevitable</h2>
        <p className="text-muted-foreground mb-4">
          Networx is a &quot;By Artists, For Artists&quot; ecosystem. We are the first platform to combine high-fidelity democratic radio with a professional &quot;Pro-Network&quot; hub.
        </p>
        <p className="text-muted-foreground mb-4">
          We don&apos;t believe in the &quot;mysterious artist&quot; enigma. We believe in the Human Artist. Our platform is built on real-time engagement through our Live Sync Chat, allowing creators to stand shoulder-to-shoulder with their listeners.
        </p>
        <p className="text-muted-foreground mb-6">
          More importantly, we are a bridge. We connect the inexperienced &quot;hidden gem&quot; with the seasoned veteran. Through our LinkedIn-style portal, we facilitate mentorships where service providers—photographers, promoters, and producers—guide the next generation on their journey to fame. We aren&apos;t just playing music; we are architecting careers.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">The Networx Values (The Code)</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-3 mb-6">
          <li><strong className="text-foreground">Potential in Everyone:</strong> We believe talent is universal, but opportunity is not. We are here to fix the distribution.</li>
          <li><strong className="text-foreground">The &quot;Trial by Fire&quot; Democracy:</strong> True representation matters. Our charts aren&apos;t bought; they are earned. Votes reflect the true opinion of the people, pushing every artist to constantly improve through healthy competition.</li>
          <li><strong className="text-foreground">Pure Listening, No Noise:</strong> Music should be free to hear without the interruption of annoying, intrusive ads. We keep the frequency clean so the focus stays on the sound.</li>
          <li><strong className="text-foreground">Human Connectivity:</strong> We reject the &quot;enigma&quot; model. We encourage community interaction. If your song is playing, you should be in the room with your fans.</li>
          <li><strong className="text-foreground">Mentorship over Monopoly:</strong> We believe the experienced have a duty to guide the inexperienced. Our platform is a professional hub designed to foster guidance, not gatekeeping.</li>
        </ul>

        <Card className="mt-12 border-primary/30 bg-primary/5">
          <CardContent className="pt-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Join the movement</h3>
            <p className="text-muted-foreground mb-4">
              When we explain the gas station story, it proves that Networx isn&apos;t just about code—it&apos;s about a real friendship and a shared struggle. Join the Founding 100 and be part of something built for artists, by artists.
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
