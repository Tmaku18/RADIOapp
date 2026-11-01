import { NextResponse } from 'next/server';

const body = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ['8QZ4S3G53V.com.tmaktechnologies.networxradio'],
        components: [
          { '/': '/song/*' },
          { '/': '/artists/*' },
          { '/': '/radio/*' },
        ],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
