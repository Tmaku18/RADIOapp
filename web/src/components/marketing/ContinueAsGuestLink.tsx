'use client';

import { useRouter } from 'next/navigation';
import { startGuestBrowse } from '@/lib/guest';

export function ContinueAsGuestLink({
  className,
  href = '/listen',
}: {
  className?: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        startGuestBrowse();
        router.push(href);
      }}
    >
      Continue as guest
    </button>
  );
}
