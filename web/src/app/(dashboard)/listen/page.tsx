'use client';

import { Suspense } from 'react';
import { RadioListenExperience } from '@/components/radio/RadioListenExperience';

function ListenPageContent() {
  return <RadioListenExperience />;
}

export default function ListenPage() {
  return (
    <Suspense fallback={null}>
      <ListenPageContent />
    </Suspense>
  );
}
