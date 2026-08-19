'use client';

import { ButterflyPattern } from '@/components/marketing/ButterflyPattern';

/** Shared wallpaper for DMs and radio live chat. */
export function ChatWallpaper({
  className = 'absolute inset-0',
}: {
  className?: string;
}) {
  return (
    <ButterflyPattern
      className={className}
      colorClassName="text-cyan-300"
      tile={140}
      opacity={0.1}
    />
  );
}
