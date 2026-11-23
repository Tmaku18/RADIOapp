import { NextResponse } from 'next/server';

const body = {
  applinks: {
    apps: [],
    details: [
      {
        appID: '8QZ4S3G53V.com.tmaktechnologies.networxradio',
        appIDs: ['8QZ4S3G53V.com.tmaktechnologies.networxradio'],
        paths: [
          '/artists/*',
          '/artist/*',
          '/open/artists/*',
          '/open/artist/*',
          '/song/*',
          '/songs/*',
          '/open/song/*',
          '/open/songs/*',
          '/radio/*',
          '/open/radio/*',
        ],
        components: [
          { '/': '/artists/*' },
          { '/': '/artist/*' },
          { '/': '/open/artists/*' },
          { '/': '/open/artist/*' },
          { '/': '/song/*' },
          { '/': '/songs/*' },
          { '/': '/open/song/*' },
          { '/': '/open/songs/*' },
          { '/': '/radio/*' },
          { '/': '/open/radio/*' },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  });
}
