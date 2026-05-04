'use client';

import { RadioPlayer } from '@/components/radio/RadioPlayer';

export default function ProNetworxRadioPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground">Networks Radio</h1>
        <p className="text-sm text-muted-foreground">
          Listen while you browse. Audio keeps playing as you move between tabs.
        </p>
      </div>
      <RadioPlayer />
    </div>
  );
}
