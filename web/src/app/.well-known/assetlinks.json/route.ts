import { NextResponse } from 'next/server';

export function GET() {
  const fingerprints = (process.env.ANDROID_APP_LINK_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.tmaktechnologies.networxradio',
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
