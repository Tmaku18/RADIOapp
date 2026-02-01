import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About - RadioApp',
  description: 'Learn about RadioApp, the underground music radio platform helping artists get discovered.',
};

export const revalidate = 3600;

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-foreground mb-8">About RadioApp</h1>
      
      <div className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground">
        <p className="text-xl text-muted-foreground mb-8">
          RadioApp is a radio-style streaming platform designed to promote underground artists 
          by allowing them to upload music and pay for airplay while listeners tune in to a 
          continuous curated stream.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Our Mission</h2>
        <p className="text-muted-foreground mb-6">
          We believe in democratizing music discovery. Major platforms favor established artists, 
          making it nearly impossible for emerging talent to break through. RadioApp levels the 
          playing field by giving underground artists direct access to engaged listeners.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">How It Works</h2>
        
        <h3 className="text-xl font-semibold text-foreground mt-8 mb-3">For Artists</h3>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Upload your tracks for review by our moderation team</li>
          <li>Once approved, your music enters our radio rotation</li>
          <li>Purchase play credits to boost your visibility</li>
          <li>Track your performance with detailed analytics</li>
          <li>Build a fanbase through organic discovery</li>
        </ul>

        <h3 className="text-xl font-semibold text-foreground mt-8 mb-3">For Listeners</h3>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Tune in to our 24/7 curated radio stream</li>
          <li>Discover emerging artists before they blow up</li>
          <li>Like tracks to save them and support artists</li>
          <li>No algorithms - just pure music discovery</li>
          <li>Free to listen, forever</li>
        </ul>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Fair Rotation System</h2>
        <p className="text-muted-foreground mb-6">
          Our radio system dynamically prioritizes tracks based on purchased credits, 
          engagement metrics, and fairness rules to prevent repetition. This ensures 
          that both promoted tracks and organic discoveries get airtime, creating a 
          balanced listening experience.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-12 mb-4">Built for Artists</h2>
        <p className="text-muted-foreground mb-6">
          Unlike streaming platforms that pay fractions of a cent per play, RadioApp 
          flips the model. Artists invest in promotion and receive genuine exposure 
          to listeners who are actively seeking new music. Every play counts, and 
          every listener is engaged.
        </p>

        <Card className="mt-12">
          <CardContent className="pt-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">Ready to get started?</h3>
            <p className="text-muted-foreground mb-4">
              Join thousands of artists and listeners already on RadioApp.
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
