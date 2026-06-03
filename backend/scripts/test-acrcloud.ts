/* eslint-disable no-console */
/**
 * Standalone connectivity/credentials test for the ACRCloud integration.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/test-acrcloud.ts                 # synthesizes a tone (auth test)
 *   npx ts-node scripts/test-acrcloud.ts path/to/song.mp3  # real detection test
 *
 * Interpreting the ACRCloud status code:
 *   0    -> SUCCESS, a commercial recording matched (detection works!)
 *   1001 -> No result (auth OK; the audio just didn't match anything)
 *   3001 -> Missing/invalid access key
 *   3003 -> Limit exceeded (trial/plan quota)
 *   3014 -> Invalid signature (secret or signing string wrong)
 */
import * as crypto from 'crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';

const ENDPOINT = '/v1/identify';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  const envPath = join(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) out[key] = val;
    }
  }
  return out;
}

function buildSignature(
  accessKey: string,
  accessSecret: string,
  timestamp: string,
): string {
  const stringToSign = [
    'POST',
    ENDPOINT,
    accessKey,
    'audio',
    '1',
    timestamp,
  ].join('\n');
  return crypto
    .createHmac('sha1', accessSecret)
    .update(Buffer.from(stringToSign, 'utf-8'))
    .digest('base64');
}

async function getSample(fileArg: string | undefined): Promise<Buffer> {
  if (fileArg) {
    console.log(`Using audio file: ${fileArg}`);
    return fs.readFile(fileArg);
  }
  const ffmpegPath =
    typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static not available to synthesize a test tone');
  }
  const out = join(tmpdir(), `acrcloud-tone-${Date.now()}.wav`);
  console.log('No file provided — synthesizing a 12s tone (auth/connectivity test only)...');
  execFileSync(ffmpegPath, [
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=12',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-y',
    out,
  ]);
  const buf = await fs.readFile(out);
  await fs.rm(out, { force: true });
  return buf;
}

async function main() {
  const env = loadEnv();
  const host = (env.ACRCLOUD_HOST || '').trim();
  const accessKey = (env.ACRCLOUD_ACCESS_KEY || '').trim();
  const accessSecret = (env.ACRCLOUD_ACCESS_SECRET || '').trim();

  if (!host || !accessKey || !accessSecret) {
    console.error(
      'Missing ACRCloud config. Ensure ACRCLOUD_HOST, ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET are set in backend/.env',
    );
    process.exit(1);
  }

  console.log(`Host: ${host}`);
  console.log(`Access key: ${accessKey.slice(0, 6)}...`);

  const fullBuffer = await getSample(process.argv[2]);
  const sample = fullBuffer.subarray(0, Math.min(fullBuffer.length, 1_000_000));

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildSignature(accessKey, accessSecret, timestamp);

  const form = new FormData();
  form.append('access_key', accessKey);
  form.append('data_type', 'audio');
  form.append('signature_version', '1');
  form.append('signature', signature);
  form.append('sample_bytes', sample.length.toString());
  form.append('timestamp', timestamp);
  form.append(
    'sample',
    new Blob([new Uint8Array(sample)], { type: 'application/octet-stream' }),
    'sample',
  );

  const url = `https://${host}${ENDPOINT}`;
  console.log(`\nPOST ${url}  (sample ${sample.length} bytes)\n`);

  const res = await fetch(url, { method: 'POST', body: form });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`Non-JSON response (HTTP ${res.status}):`, text.slice(0, 500));
    process.exit(1);
  }

  const code = json?.status?.code;
  const msg = json?.status?.msg;
  console.log(`ACRCloud status: code=${code} msg="${msg}"`);

  if (code === 0) {
    const music = json?.metadata?.music ?? [];
    if (music.length > 0) {
      console.log(`\n✅ MATCH FOUND (${music.length}) — detection is working:`);
      for (const m of music) {
        const artists = (m.artists || []).map((a: any) => a.name).join(', ');
        console.log(
          `  • "${m.title}" by ${artists || 'unknown'} — score ${m.score}`,
        );
      }
    } else {
      console.log(
        '\n✅ AUTH OK — ACRCloud returned Success with no music match.\n   Expected for a synthetic tone. Run again with a real commercial song to verify detection.',
      );
    }
  } else if (code === 1001) {
    console.log(
      '\n✅ AUTH OK — credentials and signature are valid. (No match, expected for a synthetic tone.)\n   Run again with a real commercial song file to verify detection.',
    );
  } else {
    console.log(
      '\n❌ Problem — see the code above (3001=bad key, 3014=bad signature/secret, 3003=quota).',
    );
    console.log(JSON.stringify(json, null, 2));
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
