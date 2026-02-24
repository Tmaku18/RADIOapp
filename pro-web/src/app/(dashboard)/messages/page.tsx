import { Suspense } from 'react';
import { MessagesClient } from './MessagesClient';

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="container max-w-4xl py-6 text-muted-foreground">Loading…</div>}>
      <MessagesClient />
    </Suspense>
  );
}
