import { createHash, createHmac } from 'crypto';

/**
 * Optional Cloudflare R2 store. When the env vars are unset, callers keep
 * using Supabase Storage. Songs stay private (signed GETs). Public buckets
 * can be served from R2_PUBLIC_BASE_URL.
 *
 * A dedicated R2_BUCKET_<NAME> stores that logical bucket's keys as-is.
 * Otherwise every logical bucket shares R2_BUCKET_PUBLIC and objects are
 * stored under `<logical>/<key>` so one public domain can serve them.
 */

export const R2_IMMUTABLE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';

const LOGICAL_BUCKETS = [
  'songs',
  'artwork',
  'avatars',
  'feed',
  'portfolio',
  'dm-media',
  'dj-soundboard',
  'resumes',
] as const;

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

function specificBucketEnv(logical: string): string | undefined {
  const map: Record<string, string | undefined> = {
    songs: process.env.R2_BUCKET_SONGS,
    artwork: process.env.R2_BUCKET_ARTWORK,
    avatars: process.env.R2_BUCKET_AVATARS,
    feed: process.env.R2_BUCKET_FEED,
    portfolio: process.env.R2_BUCKET_PORTFOLIO,
    'dm-media': process.env.R2_BUCKET_DM_MEDIA,
    'dj-soundboard': process.env.R2_BUCKET_DJ_SOUNDBOARD,
    resumes: process.env.R2_BUCKET_RESUMES,
  };
  return map[logical]?.trim() || undefined;
}

export function r2BucketName(logical: string): string | null {
  const name = (specificBucketEnv(logical) || process.env.R2_BUCKET_PUBLIC || '').trim();
  return name || null;
}

/** True when this logical bucket can be read and written on R2. */
export function r2Enabled(logical: string): boolean {
  return Boolean(r2Config() && r2BucketName(logical));
}

/**
 * Object key inside the physical bucket. Shared public buckets prefix the
 * logical name so artwork and avatars cannot collide.
 */
export function r2ObjectKey(logical: string, key: string): string {
  const clean = key.replace(/^\/+/, '');
  if (specificBucketEnv(logical)) return clean;
  return `${logical}/${clean}`;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
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

function amzStamp(now = new Date()): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function endpointHost(cfg: R2Config): string {
  return `${cfg.accountId}.r2.cloudflarestorage.com`;
}

/** Short-lived signed GET for a private object. `bucket` is the physical bucket. */
export function presignR2Get(
  bucket: string,
  key: string,
  expiresSeconds: number,
): string | null {
  const cfg = r2Config();
  if (!cfg) return null;
  const host = endpointHost(cfg);
  const { amzDate, dateStamp } = amzStamp();
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
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join(
    '\n',
  );
  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  return `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

/**
 * Presigned PUT. Only `host` is signed, so existing clients that send
 * Content-Type (and nothing else) keep working. `contentType` is recorded
 * for callers that want to echo it; it is not part of the signature.
 */
export function presignR2Put(
  bucket: string,
  key: string,
  contentType: string,
  expiresSeconds: number,
): { url: string; headers: Record<string, string> } | null {
  const cfg = r2Config();
  if (!cfg) return null;
  const host = endpointHost(cfg);
  const { amzDate, dateStamp } = amzStamp();
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
    'PUT',
    canonicalUri,
    query,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join(
    '\n',
  );
  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  return {
    url: `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': R2_IMMUTABLE_CACHE_CONTROL,
    },
  };
}

export function presignLogicalPut(
  logical: string,
  key: string,
  contentType: string,
  expiresSeconds: number,
): { url: string; headers: Record<string, string> } | null {
  const bucket = r2BucketName(logical);
  if (!r2Config() || !bucket) return null;
  return presignR2Put(bucket, r2ObjectKey(logical, key), contentType, expiresSeconds);
}

export function presignLogicalGet(
  logical: string,
  key: string,
  expiresSeconds: number,
): string | null {
  const bucket = r2BucketName(logical);
  if (!r2Config() || !bucket) return null;
  return presignR2Get(bucket, r2ObjectKey(logical, key), expiresSeconds);
}

async function signedFetch(
  method: 'PUT' | 'HEAD' | 'DELETE',
  logical: string,
  key: string,
  body?: Buffer,
  contentType?: string,
): Promise<Response | null> {
  const bucket = r2BucketName(logical);
  const cfg = r2Config();
  if (!cfg || !bucket) return null;
  const objectKey = r2ObjectKey(logical, key);
  const payloadHash =
    method === 'PUT' && body
      ? sha256Hex(body)
      : 'UNSIGNED-PAYLOAD';
  const extra: Record<string, string> = {};
  if (method === 'PUT') {
    extra['content-type'] = contentType || 'application/octet-stream';
    extra['cache-control'] = R2_IMMUTABLE_CACHE_CONTROL;
  }
  // HEAD/DELETE sign host + amz headers. PUT also signs content metadata.
  const host = endpointHost(cfg);
  const { amzDate, dateStamp } = amzStamp();
  const canonicalUri = `/${bucket}/${encodeKey(objectKey)}`;
  const headerEntries: Array<[string, string]> = [
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (method === 'PUT') {
    headerEntries.push(
      ['cache-control', R2_IMMUTABLE_CACHE_CONTROL],
      ['content-type', contentType || 'application/octet-stream'],
    );
  }
  headerEntries.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalHeaders = headerEntries.map(([n, v]) => `${n}:${v}`).join('\n');
  const signedHeaderNames = headerEntries.map(([n]) => n).join(';');
  const canonical = [
    method,
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaderNames,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join(
    '\n',
  );
  const signature = createHmac('sha256', signingKey(cfg.secretAccessKey, dateStamp))
    .update(stringToSign, 'utf8')
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;
  const headers: Record<string, string> = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization,
  };
  if (method === 'PUT') {
    headers['content-type'] = contentType || 'application/octet-stream';
    headers['cache-control'] = R2_IMMUTABLE_CACHE_CONTROL;
  }
  return fetch(`https://${host}${canonicalUri}`, {
    method,
    headers,
    body: method === 'PUT' && body ? new Uint8Array(body) : undefined,
  });
}

export async function putR2Object(
  logicalBucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!r2Enabled(logicalBucket)) return;
  const response = await signedFetch('PUT', logicalBucket, key, body, contentType);
  if (!response) return;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 put failed (${response.status}): ${text.slice(0, 180)}`);
  }
}

export async function headR2Object(logical: string, key: string): Promise<boolean> {
  if (!r2Enabled(logical)) return false;
  const response = await signedFetch('HEAD', logical, key);
  if (!response) return false;
  if (response.status === 404) return false;
  return response.ok;
}

export async function deleteR2Object(logical: string, key: string): Promise<void> {
  if (!r2Enabled(logical)) return;
  const response = await signedFetch('DELETE', logical, key);
  if (!response) return;
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(`R2 delete failed (${response.status}): ${text.slice(0, 180)}`);
  }
}

const PRIVATE_LOGICAL = new Set(['songs', 'resumes']);

export function r2PublicUrl(logicalBucket: string, key: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!base || PRIVATE_LOGICAL.has(logicalBucket) || !r2Enabled(logicalBucket)) {
    return null;
  }
  const objectKey = r2ObjectKey(logicalBucket, key);
  return `${base}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
}

/** Supabase public URL used as the stored reference for private song objects. */
export function supabasePublicObjectUrl(logical: string, key: string): string {
  const base = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const clean = key.replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/${logical}/${clean
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

/**
 * URL persisted in the database. Public media prefers the R2 CDN URL.
 * Songs stay as a Supabase-shaped reference so existing path parsers keep
 * working; playback always re-signs and prefers R2 when it is configured.
 */
export function storedObjectUrl(logical: string, key: string): string {
  return r2PublicUrl(logical, key) ?? supabasePublicObjectUrl(logical, key);
}

export function isKnownLogicalBucket(value: string): boolean {
  return (LOGICAL_BUCKETS as readonly string[]).includes(value);
}
