/**
 * Copy Supabase Storage objects into Cloudflare R2.
 *
 * No-ops until these are set:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_SONGS, R2_BUCKET_ARTWORK, R2_BUCKET_AVATARS, R2_BUCKET_FEED
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Does not delete Supabase objects. Drain storage only after a verified copy.
 */
import { createHash, createHmac } from 'crypto';

const required = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.log(`R2 migration skipped. Missing ${missing.join(', ')}.`);
  process.exit(0);
}

const buckets = [
  ['songs', process.env.R2_BUCKET_SONGS],
  ['artwork', process.env.R2_BUCKET_ARTWORK],
  ['avatars', process.env.R2_BUCKET_AVATARS],
  ['feed', process.env.R2_BUCKET_FEED],
].filter(([, name]) => name?.trim());

if (!buckets.length) {
  console.log('R2 migration skipped. No R2_BUCKET_* names set.');
  process.exit(0);
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function putObject(bucket, key, body, contentType) {
  const accountId = process.env.R2_ACCOUNT_ID.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY.trim();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
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
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const signingKey = hmac(hmac(hmac(kDate, 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;
  return fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
    body,
  });
}

const supabase = process.env.SUPABASE_URL.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function list(bucket, offset) {
  const url = new URL(`${supabase}/storage/v1/object/list/${bucket}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prefix: '', limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!response.ok) throw new Error(`list ${bucket} failed ${response.status}`);
  return response.json();
}

for (const [logical, r2Name] of buckets) {
  let offset = 0;
  let copied = 0;
  for (;;) {
    const page = await list(logical, offset);
    if (!Array.isArray(page) || page.length === 0) break;
    for (const item of page) {
      if (!item?.name || item.id == null) continue;
      const fileUrl = `${supabase}/storage/v1/object/${logical}/${item.name.split('/').map(encodeURIComponent).join('/')}`;
      const file = await fetch(fileUrl, {
        headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      });
      if (!file.ok) {
        console.warn(`skip ${logical}/${item.name} (${file.status})`);
        continue;
      }
      const body = Buffer.from(await file.arrayBuffer());
      const put = await putObject(r2Name, item.name, body, file.headers.get('content-type') || 'application/octet-stream');
      if (!put.ok) {
        console.warn(`r2 put failed ${logical}/${item.name} (${put.status})`);
        continue;
      }
      copied += 1;
    }
    offset += page.length;
    if (page.length < 100) break;
  }
  console.log(`copied ${copied} objects from ${logical} to ${r2Name}`);
}
