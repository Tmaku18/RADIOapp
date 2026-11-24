'use client';

import { useEffect } from 'react';

/**
 * Kept so marketing visuals can subscribe later. The global `likes` realtime
 * feed read every insert and nothing on the site renders it, so it stays off.
 */
export function useLikeEvents(onLike: () => void) {
  useEffect(() => {
    void onLike;
  }, [onLike]);
}
