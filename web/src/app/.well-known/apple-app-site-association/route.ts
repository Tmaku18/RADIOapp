import { NextResponse } from 'next/server';

const body = {
  applinks: {
    apps: [],
    details: [
      {
        appID: '8QZ4S3G53V.com.tmaktechnologies.networxradio',
        appIDs: ['8QZ4S3G53V.com.tmaktechnologies.networxradio'],
        paths: ['/artists/*', '/artist/*', '/song/*', '/songs/*', '/radio/*'],
        components: [
          { '/': '/artists/*' },
          { '/': '/artist/*' },
          { '/': '/song/*' },
          { '/': '/songs/*' },
          { '/': '/radio/*' },
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
