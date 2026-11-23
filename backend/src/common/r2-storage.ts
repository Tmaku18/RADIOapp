import { createHash, createHmac } from 'crypto';

/**
 * Optional Cloudflare R2 mirror. When the env vars are unset, callers keep
 * using Supabase Storage. Songs stay private (signed GETs). Public buckets
 * can be served from R2_PUBLIC_BASE_URL.
 */

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return { accountId, accessKeyId, secretAccessKey };
}

export function r2BucketName(logical: string): string | null {
  const specific: Record<string, string | undefined> = {
    songs: process.env.R2_BUCKET_SONGS,
    artwork: process.env.R2_BUCKET_ARTWORK,
    avatars: process.env.R2_BUCKET_AVATARS,
    feed: process.env.R2_BUCKET_FEED,
  };
  const name = (specific[logical] || process.env.R2_BUCKET_PUBLIC || '').trim();
  return name || null;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function signingKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function encodeKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

/** Short-lived signed GET for a private object. */
export function presignR2Get(
  bucket: string,
  key: string,
  expiresSeconds: number,
): string | null {
  const cfg = r2Config();
  if (!cfg) return null;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const credential = `${cfg.accessKeyId}/${dateStamp}/auto/s3/aws4_request`;
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const canonical = [
    'GET',
    canonicalUri,
    query,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonical),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  return `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

export async function putR2Object(
  logicalBucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const cfg = r2Config();
  const bucket = r2BucketName(logicalBucket);
  if (!cfg || !bucket) return;
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash('sha256').update(body).digest('hex');
  const canonical = [
    'PUT',
    canonicalUri,
    '',
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
    'content-type;host;x-amz-content-sha256;x-amz-date',
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonical),
  ].join('\n');
  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;
  const response = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 put failed (${response.status}): ${text.slice(0, 180)}`);
  }
}

export function r2PublicUrl(logicalBucket: string, key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!base || logicalBucket === 'songs') return null;
  return `${base}/${logicalBucket}/${key}`;
}
