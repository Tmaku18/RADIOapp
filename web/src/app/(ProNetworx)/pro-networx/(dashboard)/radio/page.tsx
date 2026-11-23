'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { RadioListenExperience } from '@/components/radio/RadioListenExperience';
import { DEFAULT_STATION_ID } from '@/data/station-map';
import { getSiteUrl } from '@/lib/site-url';

function ProNetworxRadioContent() {
  const searchParams = useSearchParams();
  const station = searchParams.get('station')?.trim() || DEFAULT_STATION_ID;

  const changeStationHref = useMemo(
    () =>
      `${getSiteUrl()}/discover?tab=station&station=${encodeURIComponent(station)}`,
    [station],
  );

  return (
    <RadioListenExperience
      changeStationHref={changeStationHref}
      changeStationExternal
    />
  );
}

export default function ProNetworxRadioPage() {
  return (
    <Suspense fallback={null}>
      <ProNetworxRadioContent />
    </Suspense>
  );
}
