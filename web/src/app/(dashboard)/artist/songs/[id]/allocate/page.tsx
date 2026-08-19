'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Credits/allocate is gone — send artists to buy placements for this song. */
export default function AllocateRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? '');

  useEffect(() => {
    if (!id) return;
    router.replace(`/artist/songs/${id}/buy-plays`);
  }, [id, router]);

  return null;
}
