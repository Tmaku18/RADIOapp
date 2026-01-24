'use client';

import { RadioPlayer } from '@/components/radio/RadioPlayer';

export default function ListenPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Now Playing</h1>
        <p className="text-gray-600">
          Discover underground artists on RadioApp
        </p>
      </div>

      <RadioPlayer />

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Everyone listening hears the same stream. <br />
          Like a song to save it and support the artist.
        </p>
      </div>
    </div>
  );
}
