import { NextResponse } from 'next/server';
import { ANDROID_PACKAGE_NAME, resolveAndroidAppLinkFingerprints } from '@/lib/app-links';

export function GET() {
  const fingerprints = resolveAndroidAppLinkFingerprints();

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: ANDROID_PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
      },
    },
  );
}
