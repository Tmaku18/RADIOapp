/**
 * Copy Supabase Storage objects into Cloudflare R2.
 *
 * Usage:
 *   node scripts/migrate-media-to-r2.mjs            # copy, keep Supabase objects
 *   node scripts/migrate-media-to-r2.mjs --dry-run
 *   node scripts/migrate-media-to-r2.mjs --rewrite-db-urls
 *
 * Required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_BUCKET_SONGS and/or R2_BUCKET_PUBLIC (plus optional per-bucket names)
 *
 * --rewrite-db-urls also needs DATABASE_URL and R2_PUBLIC_BASE_URL.
 * It rewrites public image and feed URLs. Song audio URLs stay in the
 * Supabase public shape so the API can keep re-signing them.
 * Supabase objects are not deleted. Drain them only after playback is verified.
 */
import { createHash, createHmac } from 'crypto';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const rewriteDb = process.argv.includes('--rewrite-db-urls');

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

const logicalBuckets = [
  'songs',
  'artwork',
  'avatars',
  'feed',
  'portfolio',
  'dm-media',
  'dj-soundboard',
];

function specificBucket(logical) {
  const map = {
    songs: process.env.R2_BUCKET_SONGS,
    artwork: process.env.R2_BUCKET_ARTWORK,
    avatars: process.env.R2_BUCKET_AVATARS,
    feed: process.env.R2_BUCKET_FEED,
    portfolio: process.env.R2_BUCKET_PORTFOLIO,
    'dm-media': process.env.R2_BUCKET_DM_MEDIA,
    'dj-soundboard': process.env.R2_BUCKET_DJ_SOUNDBOARD,
  };
  return map[logical]?.trim() || '';
}

function physicalBucket(logical) {
  return specificBucket(logical) || process.env.R2_BUCKET_PUBLIC?.trim() || '';
}

function objectKey(logical, key) {
  const clean = key.replace(/^\/+/, '');
  if (specificBucket(logical)) return clean;
  return `${logical}/${clean}`;
}

const buckets = logicalBuckets
  .map((logical) => [logical, physicalBucket(logical)])
  .filter(([, name]) => name);

if (!buckets.length) {
  console.log('R2 migration skipped. No R2_BUCKET_* names set.');
  process.exit(0);
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function signingKey(secret, dateStamp) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), 'auto'), 's3'), 'aws4_request');
}

function encodeKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function signedRequest(method, bucket, key, body, contentType) {
  const accountId = process.env.R2_ACCOUNT_ID.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY.trim();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? sha256Hex(body) : 'UNSIGNED-PAYLOAD';
  const headers = [
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (method === 'PUT') {
    headers.push(['cache-control', CACHE_CONTROL], ['content-type', contentType]);
  }
  headers.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalHeaders = headers.map(([name, value]) => `${name}:${value}`).join('\n');
  const signedHeaders = headers.map(([name]) => name).join(';');
  const canonical = [
    method,
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  const signature = createHmac('sha256', signingKey(secret, dateStamp))
    .update(stringToSign)
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const requestHeaders = {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization,
  };
  if (method === 'PUT') {
    requestHeaders['content-type'] = contentType;
    requestHeaders['cache-control'] = CACHE_CONTROL;
  }
  return fetch(`https://${host}${canonicalUri}`, {
    method,
    headers: requestHeaders,
    body: body ?? undefined,
  });
}

const supabase = process.env.SUPABASE_URL.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listPage(bucket, prefix, offset) {
  const response = await fetch(`${supabase}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      prefix,
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!response.ok) throw new Error(`list ${bucket} failed ${response.status}`);
  return response.json();
}

async function listAll(bucket, prefix = '') {
  const files = [];
  let offset = 0;
  for (;;) {
    const page = await listPage(bucket, prefix, offset);
    if (!Array.isArray(page) || page.length === 0) break;
    for (const item of page) {
      if (!item?.name) continue;
      const child = `${prefix}${item.name}`;
      if (item.id == null) {
        files.push(...(await listAll(bucket, `${child}/`)));
      } else {
        files.push(child);
      }
    }
    offset += page.length;
    if (page.length < 100) break;
  }
  return files;
}

let copied = 0;
let skipped = 0;
for (const [logical, r2Name] of buckets) {
  const files = await listAll(logical, '');
  let bucketCopied = 0;
  for (const name of files) {
    const key = objectKey(logical, name);
    if (!dryRun) {
      const head = await signedRequest('HEAD', r2Name, key);
      if (head.ok) {
        skipped += 1;
        continue;
      }
    }
    if (dryRun) {
      bucketCopied += 1;
      continue;
    }
    const fileUrl = `${supabase}/storage/v1/object/${logical}/${name
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const file = await fetch(fileUrl, {
      headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!file.ok) {
      console.warn(`skip ${logical}/${name} (${file.status})`);
      continue;
    }
    const body = Buffer.from(await file.arrayBuffer());
    const put = await signedRequest(
      'PUT',
      r2Name,
      key,
      body,
      file.headers.get('content-type') || 'application/octet-stream',
    );
    if (!put.ok) {
      console.warn(`r2 put failed ${logical}/${name} (${put.status})`);
      continue;
    }
    bucketCopied += 1;
  }
  copied += bucketCopied;
  console.log(
    `${dryRun ? 'would copy' : 'copied'} ${bucketCopied} objects from ${logical} to ${r2Name} (${skipped} already in R2)`,
  );
}

const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
const rewriteTargets = [
  ['public', 'songs', 'artwork_url', 'artwork'],
  ['public', 'songs', 'discover_background_url', 'artwork'],
  ['public', 'users', 'avatar_url', 'avatars'],
  ['public', 'albums', 'artwork_url', 'artwork'],
  ['public', 'discover_feed_posts', 'image_url', 'feed'],
  ['public', 'discover_feed_posts', 'audio_url', 'feed'],
  ['public', 'song_stories', 'media_url', 'feed'],
  ['public', 'studios', 'hero_image_url', 'avatars'],
];

if (rewriteDb) {
  if (!process.env.DATABASE_URL?.trim() || !publicBase) {
    console.log('URL rewrite skipped. Set DATABASE_URL and R2_PUBLIC_BASE_URL.');
  } else {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      for (const [schema, table, column, logical] of rewriteTargets) {
        const exists = await client.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
          [schema, table, column],
        );
        if (!exists.rowCount) continue;
        const marker = `/storage/v1/object/public/${logical}/`;
        const rows = await client.query(
          `SELECT ctid::text AS id, ${column} AS url FROM ${schema}.${table}
           WHERE ${column} LIKE $1`,
          [`%${marker}%`],
        );
        let changed = 0;
        for (const row of rows.rows) {
          const index = String(row.url).indexOf(marker);
          if (index < 0) continue;
          const rest = String(row.url).slice(index + marker.length).split('?')[0];
          const next = `${publicBase}/${objectKey(logical, decodeURIComponent(rest))
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`;
          if (dryRun) {
            changed += 1;
            continue;
          }
          await client.query(
            `UPDATE ${schema}.${table} SET ${column} = $1 WHERE ctid::text = $2 AND ${column} = $3`,
            [next, row.id, row.url],
          );
          changed += 1;
        }
        console.log(`${dryRun ? 'would rewrite' : 'rewrote'} ${changed} ${schema}.${table}.${column}`);
      }
    } finally {
      await client.end();
    }
  }
}

console.log(`done. copied=${copied} skipped=${skipped} dryRun=${dryRun}`);
