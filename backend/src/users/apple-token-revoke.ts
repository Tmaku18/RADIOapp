import { createSign } from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('AppleTokenRevoke');

/**
 * Best-effort Sign in with Apple token revocation (App Store 5.1.1(v)).
 * Requires APPLE_TEAM_ID plus the existing App Store key env vars.
 * Failures are logged and never block account deletion.
 */
export async function revokeAppleAuthorizationCode(
  authorizationCode: string | null | undefined,
): Promise<void> {
  const code = authorizationCode?.trim();
  if (!code) return;

  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim();
  const bundleId =
    process.env.APPLE_IAP_BUNDLE_ID?.trim() ||
    'com.tmaktechnologies.networxradio';
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) {
    logger.warn(
      'Skipping Apple token revoke: set APPLE_TEAM_ID, APPLE_IAP_KEY_ID, and APPLE_IAP_PRIVATE_KEY',
    );
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: keyId }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: bundleId,
      }),
    ).toString('base64url');
    const signer = createSign('SHA256');
    signer.update(`${header}.${payload}`);
    signer.end();
    const signature = signer
      .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
      .toString('base64url');
    const clientSecret = `${header}.${payload}.${signature}`;

    const body = new URLSearchParams({
      client_id: bundleId,
      client_secret: clientSecret,
      token: code,
      token_type_hint: 'access_token',
    });
    const res = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn(`Apple revoke returned ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    logger.warn(
      `Apple revoke failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
