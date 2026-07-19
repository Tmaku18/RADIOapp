'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /artist has no content; redirect to My Songs (songs list) so the Studio nav always lands somewhere useful.
 */
export default function ArtistIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/artist/songs');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden />
    </div>
  );
}
