import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { HeroCta } from '@/components/marketing/HeroCta';
import { LiveRippleVisualizer } from '@/components/marketing/LiveRippleVisualizer';
import { GlobalVoteMap } from '@/components/marketing/GlobalVoteMap';

// Enable ISR with 60 second revalidation
export const revalidate = 60;
const PRO_NETWORX_URL = process.env.NEXT_PUBLIC_PRO_NETWORX_URL || 'http://localhost:3002';

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
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/analytics/platform`, {
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
      {/* Hero — 4 AM story-driven; Live Ripple + dynamic CTA by role */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <LiveRippleVisualizer />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <a
            href={PRO_NETWORX_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            New: ProNetworx is live for artist growth and mentorship
          </a>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
            Build Your Audience, Team, and Career in One Platform
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Networx combines always-on democratic radio, artist livestreams, live chat, votes and ripples, transparent analytics, and ProNetworx mentorship so no hidden gem stays invisible.
          </p>
          <HeroCta />
          <div className="mt-6">
            <Button variant="outline" size="lg" asChild>
              <Link href={PRO_NETWORX_URL} target="_blank" rel="noreferrer">
                Open ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Global State Visualizer */}
      <section className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <GlobalVoteMap />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: `${data.stats.totalArtists.toLocaleString()}+`, label: 'Gems', sub: '(artists)' },
              { value: `${data.stats.totalSongs.toLocaleString()}+`, label: "Ore's", sub: '(listeners)' },
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

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Join the movement and build your network
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Whether you are a hidden gem ready to be heard, a Prospector discovering new talent, or a pro ready to mentor, Networx and ProNetworx create the bridge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/60 text-white hover:bg-white/15" asChild>
              <Link href={PRO_NETWORX_URL} target="_blank" rel="noreferrer">
                Explore ProNetworx
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
