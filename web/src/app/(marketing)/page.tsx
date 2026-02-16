import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Enable ISR with 60 second revalidation
export const revalidate = 60;

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
          totalPlays: stats.totalPlays || 0,
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
      totalPlays: 0,
    },
  };
}

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight">
            Underground Music Radio
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover undiscovered talent. Listen to curated radio from underground artists, or get your music heard by real listeners.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: `${data.stats.totalArtists.toLocaleString()}+`, label: 'Gems' },
              { value: `${data.stats.totalSongs.toLocaleString()}+`, label: 'Songs' },
              { value: `${(data.stats.totalPlays / 1000000).toFixed(1)}M+`, label: 'Discoveries' },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <CardContent className="pt-6">
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-muted-foreground mt-2">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Listeners */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              For Listeners
            </h2>
            <p className="text-xl text-muted-foreground">
              Discover your next favorite gem
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '🎵', title: 'Tune In', desc: 'Listen to our curated radio stream featuring underground artists from around the world.' },
              { icon: '❤️', title: 'Discover', desc: 'Like tracks to save them and help boost underground talent in the rotation.' },
              { icon: '🌟', title: 'Support', desc: 'Follow your favorite gems and be part of their journey to success.' },
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
              Get your music heard by real listeners
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '📤', title: 'Upload', desc: 'Submit your tracks for review. Once approved, they enter our radio rotation.' },
              { icon: '💰', title: 'Promote', desc: 'Purchase play credits to boost your tracks and reach more listeners.' },
              { icon: '📊', title: 'Analyze', desc: 'Track your discoveries, engagement, and growth with detailed analytics.' },
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
            Ready to join the revolution?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Whether you&apos;re undiscovered talent looking to grow or a listener seeking new sounds, 
            RadioApp is your home.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/signup">Get Started Free</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
