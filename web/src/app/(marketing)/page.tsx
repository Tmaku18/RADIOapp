import Link from 'next/link';
import Image from 'next/image';
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
      {/* Split Hero - Choose your path */}
      <section className="min-h-[70vh] flex flex-col">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
            Underground Music Radio
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Discover undiscovered talent. Choose your path.
          </p>
        </div>
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 h-full max-w-5xl mx-auto">
            <Link
              href="/signup?role=listener"
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <div className="aspect-[4/3] relative bg-muted">
                <Image
                  src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80"
                  alt="Listener - discover music"
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  I am a Listener
                </h2>
                <p className="text-white/90 mt-1 text-sm md:text-base">
                  Discover gems and support underground talent
                </p>
              </div>
            </Link>
            <Link
              href="/signup?role=artist"
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <div className="aspect-[4/3] relative bg-muted">
                <Image
                  src="https://images.unsplash.com/photo-1605101100278-5d8deb22c8a0?w=800&q=80"
                  alt="Creator - share your music"
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  I am a Creator
                </h2>
                <p className="text-white/90 mt-1 text-sm md:text-base">
                  Get your music heard and grow your audience
                </p>
              </div>
            </Link>
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
