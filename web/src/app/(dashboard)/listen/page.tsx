'use client';

import { Suspense } from 'react';
import { RadioListenExperience } from '@/components/radio/RadioListenExperience';

function ListenPageContent() {
  return <RadioListenExperience />;
}

export default function ListenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        </div>
      }
    >
      <ListenPageContent />
    </Suspense>
  );
}
