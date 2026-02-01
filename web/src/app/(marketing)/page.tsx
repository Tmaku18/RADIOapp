import Link from 'next/link';

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
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Underground Music Radio
            </h1>
            <p className="text-xl md:text-2xl text-purple-200 mb-8">
              Discover emerging artists. Promote your music. 
              Join the community shaping tomorrow&apos;s sound.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/signup?role=listener"
                className="bg-white text-purple-900 px-8 py-3 rounded-lg font-semibold hover:bg-purple-100 transition-colors"
              >
                Start Listening
              </Link>
              <Link 
                href="/signup?role=artist"
                className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-500 transition-colors border border-purple-400"
              >
                Promote Your Music
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-purple-600">
                {data.stats.totalArtists.toLocaleString()}+
              </div>
              <div className="text-gray-600 mt-2">Artists</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600">
                {data.stats.totalSongs.toLocaleString()}+
              </div>
              <div className="text-gray-600 mt-2">Songs</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600">
                {(data.stats.totalPlays / 1000000).toFixed(1)}M+
              </div>
              <div className="text-gray-600 mt-2">Total Plays</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Listeners */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              For Listeners
            </h2>
            <p className="text-xl text-gray-600">
              Discover your next favorite artist
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎵</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Tune In</h3>
              <p className="text-gray-600">
                Listen to our curated radio stream featuring underground artists from around the world.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">❤️</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Discover</h3>
              <p className="text-gray-600">
                Like tracks to save them and help boost artists in the rotation.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🌟</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Support</h3>
              <p className="text-gray-600">
                Follow your favorite artists and be part of their journey to success.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Artists */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              For Artists
            </h2>
            <p className="text-xl text-gray-600">
              Get your music heard by real listeners
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📤</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload</h3>
              <p className="text-gray-600">
                Submit your tracks for review. Once approved, they enter our radio rotation.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Promote</h3>
              <p className="text-gray-600">
                Purchase play credits to boost your tracks and reach more listeners.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analyze</h3>
              <p className="text-gray-600">
                Track your plays, engagement, and growth with detailed analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Artists */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Featured Artists
            </h2>
            <p className="text-xl text-gray-600">
              Trending on RadioApp this week
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.featuredArtists.map((artist) => (
              <div key={artist.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
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
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-1">{artist.name}</h3>
                  <p className="text-gray-600">{artist.genre}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to join the revolution?
          </h2>
          <p className="text-xl text-purple-200 mb-8">
            Whether you&apos;re an artist looking to grow or a listener seeking new sounds, 
            RadioApp is your home.
          </p>
          <Link 
            href="/signup"
            className="bg-white text-purple-900 px-8 py-3 rounded-lg font-semibold hover:bg-purple-100 transition-colors inline-block"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
