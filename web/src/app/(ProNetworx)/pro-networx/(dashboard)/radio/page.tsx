'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RadioListenExperience } from '@/components/radio/RadioListenExperience';
import { DEFAULT_STATION_ID } from '@/data/station-map';
import { getLastRadioStationId } from '@/lib/playback-preferences';
import { getSiteUrl } from '@/lib/site-url';

function ProNetworxRadioContent() {
  const searchParams = useSearchParams();
  const stationParam = searchParams.get('station')?.trim() || '';
  const [station, setStation] = useState(stationParam || DEFAULT_STATION_ID);

  useEffect(() => {
    setStation(stationParam || getLastRadioStationId() || DEFAULT_STATION_ID);
  }, [stationParam]);

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
