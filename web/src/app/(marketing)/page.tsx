import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { HeroCta } from '@/components/marketing/HeroCta';
import { LiveRippleVisualizer } from '@/components/marketing/LiveRippleVisualizer';
import { getBackendBaseUrl } from '@/lib/backend-url';

// Enable ISR with 60 second revalidation
export const revalidate = 60;

function formatDiscoveries(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return `${n.toLocaleString()}+`;
}

function formatListens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K+`;
  return `${n.toLocaleString()}+`;
}

// Fetch platform stats from the API
async function getHomepageData() {
  try {
    const baseUrl = getBackendBaseUrl();
    const response = await fetch(`${baseUrl}/api/analytics/platform`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    if (response.ok) {
      const stats = await response.json();
      return {
        featuredArtists: [
          { id: '1', name: 'Emerging Artist', genre: 'Electronic', imageUrl: null },
          { id: '2', name: 'Rising Star', genre: 'Hip Hop', imageUrl: null },
          { id: '3', name: 'New Voice', genre: 'Indie', imageUrl: null },
        ],
        stats: {
          totalArtists: stats.totalArtists || 0,
          totalSongs: stats.totalSongs || 0,
          totalProfileClicks: stats.totalProfileClicks ?? 0,
          totalPlays: stats.totalPlays ?? 0,
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch platform stats:', error);
  }
  
  // Fallback to default data
  return {
    featuredArtists: [
      { id: '1', name: 'Emerging Artist', genre: 'Electronic', imageUrl: null },
      { id: '2', name: 'Rising Star', genre: 'Hip Hop', imageUrl: null },
      { id: '3', name: 'New Voice', genre: 'Indie', imageUrl: null },
    ],
    stats: {
      totalArtists: 0,
      totalSongs: 0,
      totalProfileClicks: 0,
      totalPlays: 0,
    },
  };
}

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <div>
      {/* Hero — Join the movement (primary CTA above the fold) */}
      <section className="py-24 sm:py-32 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Join the movement and build your network
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Whether you are a hidden gem ready to be heard, a Prospector discovering new talent, or a pro ready to mentor, Networx and ProNetworx create the bridge.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="border-2 border-primary-foreground/90 shadow-md !text-black" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-primary-foreground/80 text-primary-foreground hover:bg-primary-foreground/15" asChild>
              <Link href="/pro-networx">
                Explore ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Supporting hero — platform value prop + visualizer */}
      <section className="relative py-16 sm:py-20 overflow-hidden border-b border-border">
        <LiveRippleVisualizer />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Build your audience, team, and career in one platform
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Always-on radio, livestreams, votes and ripples, transparent analytics, and ProNetworx mentorship.
          </p>
          <HeroCta />
        </div>
      </section>

      {/* 4 AM Story — blue section to alternate with dark */}
      <section className="py-16 sm:py-20 bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-center">
            Our Story: The 4 AM Catalyst
          </h2>
          <div className="space-y-4 text-primary-foreground/90 font-story text-2xl leading-relaxed">
            <p>
              Most tech companies start in a Silicon Valley garage. Networx started at a gas station at 4 AM.
            </p>
            <p>
              That was where Tanaka and Merquise first crossed paths. It was a random connection—a &quot;butterfly effect&quot; in its purest form. We were two people who, on paper, were struggling financially, but in reality, were rich in skills and belief. As our friendship grew, we saw each other&apos;s strengths: Tanaka, the architect with the technical vision to build the impossible; Merquise, the strategist with the heart to find the talent others overlooked.
            </p>
            <p>
              We realized that our meeting shouldn&apos;t have been a fluke. We pushed each other to succeed when the world wasn&apos;t looking. We realized that society is full of &quot;bright lights&quot; that are allowed to die out simply because they didn&apos;t have a bridge to the right room. We decided that allowing talent to go to waste is more than a shame—it is a crime. We built Networx to make those 4 AM moments happen for everyone.
            </p>
          </div>
          <div className="mt-8 text-center">
            <Button variant="secondary" size="lg" className="border-2 border-primary-foreground/90 shadow-md" asChild>
              <Link href="/about">Read full story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: `${data.stats.totalArtists.toLocaleString()}+`, label: 'Gems', sub: '(artists)' },
              { value: `${data.stats.totalSongs.toLocaleString()}+`, label: 'Tracks', sub: '(songs)' },
              { value: formatDiscoveries(data.stats.totalProfileClicks), label: 'Discoveries', sub: '(profile clicks)' },
              { value: formatListens(data.stats.totalPlays), label: 'Total listens', sub: '(songs heard)' },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <CardContent className="pt-6">
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-muted-foreground mt-2">{stat.label}</div>
                  <div className="text-muted-foreground/80 text-sm mt-0.5">{stat.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Prospectors */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              For Prospectors
            </h2>
            <p className="text-xl text-muted-foreground">
              Discover your next favorite gem in real time
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '🎵', title: 'Always-On Radio', desc: 'Jump into a continuous stream where listeners share the same moment of discovery.' },
              { icon: '💬', title: 'Vote + Live Chat', desc: 'Ripple, vote, and connect while tracks are playing so artists get immediate feedback.' },
              { icon: '🎥', title: 'Join Artist Livestreams', desc: 'Watch artists go live, interact directly, and support them with donations during sessions.' },
            ].map((item) => (
              <Card key={item.title} className="text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-3xl">{item.icon}</span>
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Gems (underground artists) */}
      <section className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              For Gems
            </h2>
            <p className="text-xl text-muted-foreground">
              Launch and grow with tools built for real fans
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '📤', title: 'Upload + Release', desc: 'Submit tracks for moderation and get played in rotation once approved.' },
              { icon: '🚀', title: 'Promote with Credits', desc: 'Use play credits to increase visibility while still earning organic discovery.' },
              { icon: '📊', title: 'The Wake Analytics', desc: 'Track listens, discoveries, engagement, and audience growth over time.' },
            ].map((item) => (
              <Card key={item.title} className="text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-3xl">{item.icon}</span>
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Diamonds (featured underground talent) */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Diamonds
            </h2>
            <p className="text-xl text-muted-foreground">
              Undiscovered talent in the spotlight
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.featuredArtists.map((artist) => (
              <Card key={artist.id} className="overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  {artist.imageUrl ? (
                    <img 
                      src={artist.imageUrl} 
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">🎤</span>
                  )}
                </div>
                <CardHeader>
                  <h3 className="text-xl font-semibold">{artist.name}</h3>
                  <p className="text-muted-foreground">{artist.genre}</p>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to get started?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="!text-black" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pro-networx">
                Explore ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
