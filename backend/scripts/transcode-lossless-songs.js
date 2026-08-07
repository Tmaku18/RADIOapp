#!/usr/bin/env node
/**
 * One-off backfill: re-encode lossless / oversized catalog audio to 192 kbps
 * MP3 so radio streaming never outruns a phone connection.
 *
 * A third of the launch catalog was uploaded as raw WAV masters (1.4–3 Mbps).
 * Streaming those in real time stalls on cellular and produces the
 * "song freezes, then skips" listener experience. New uploads are transcoded
 * by the backend (AudioTranscodeService); this script fixes the rows that
 * already exist.
 *
 * For each song whose effective bitrate exceeds 400 kbps (or whose
 * content-type is WAV/AIFF/FLAC):
 *   1. download the original from the private `songs` bucket
 *   2. ffmpeg -> MP3 192k
 *   3. verify the MP3 duration matches the original within 3 seconds
 *   4. upload the MP3 next to the original (original is never deleted)
 *   5. point songs.audio_url at the MP3
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/transcode-lossless-songs.js [--dry-run]
 *
 * Requires ffmpeg: uses FFMPEG_PATH, system ffmpeg, or node_modules/ffmpeg-static.
 */

const { createClient } = require('@supabase/supabase-js');
const { spawnSync } = require('child_process');
const { existsSync, writeFileSync, readFileSync, unlinkSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const MAX_STREAM_KBPS = 400;
const DRY_RUN = process.argv.includes('--dry-run');

function resolveFfmpeg() {
  const configured = (process.env.FFMPEG_PATH || '').trim();
  if (configured && existsSync(configured)) return configured;
  for (const p of ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg']) {
    if (existsSync(p)) return p;
  }
  try {
    const staticPath = require('ffmpeg-static');
    if (typeof staticPath === 'string' && existsSync(staticPath)) return staticPath;
  } catch {}
  return null;
}

async function mp3DurationSeconds(buffer) {
  const mm = await import('music-metadata');
  const meta = await mm.parseBuffer(buffer, { mimeType: 'audio/mpeg' });
  return meta.format.duration ?? null;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  const ffmpegBin = resolveFfmpeg();
  if (!ffmpegBin) {
    console.error('ffmpeg not found (FFMPEG_PATH / system / ffmpeg-static)');
    process.exit(1);
  }
  console.log('ffmpeg:', ffmpegBin, DRY_RUN ? '(DRY RUN)' : '');

  const sb = createClient(url, key);
  const { data: songs, error } = await sb
    .from('songs')
    .select('id,title,duration_seconds,audio_url')
    .not('audio_url', 'is', null);
  if (error) throw new Error(error.message);

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const marker = '/object/public/songs/';
    const idx = (song.audio_url || '').indexOf(marker);
    if (idx === -1) {
      skipped++;
      continue;
    }
    const path = decodeURIComponent(song.audio_url.slice(idx + marker.length));
    // Skip files this script already produced.
    if (/-stream192(-\d+)?\.mp3$/.test(path)) {
      skipped++;
      continue;
    }

    const { data: signed, error: signErr } = await sb.storage
      .from('songs')
      .createSignedUrl(path, 600);
    if (signErr) {
      console.log(`SIGN FAIL  ${song.title}: ${signErr.message}`);
      failed++;
      continue;
    }

    const head = await fetch(signed.signedUrl, { method: 'HEAD' });
    if (!head.ok) {
      console.log(`HEAD FAIL  ${song.title}: ${head.status}`);
      failed++;
      continue;
    }
    const sizeBytes = Number(head.headers.get('content-length') || 0);
    const contentType = (head.headers.get('content-type') || '').toLowerCase();
    const duration = Number(song.duration_seconds || 0);
    const kbps = duration > 0 ? (sizeBytes * 8) / duration / 1000 : 0;
    const lossless = /wav|aiff|flac/.test(contentType);

    if (!lossless && (kbps === 0 || kbps <= MAX_STREAM_KBPS)) {
      skipped++;
      continue;
    }

    console.log(
      `TRANSCODE  ${song.title} — ${(sizeBytes / 1048576).toFixed(1)}MB, ${Math.round(kbps)} kbps, ${contentType}`,
    );
    if (DRY_RUN) {
      converted++;
      continue;
    }

    try {
      const res = await fetch(signed.signedUrl);
      const original = Buffer.from(await res.arrayBuffer());

      const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const inPath = join(tmpdir(), `bf-in-${runId}.bin`);
      const outPath = join(tmpdir(), `bf-out-${runId}.mp3`);
      writeFileSync(inPath, original);
      const ff = spawnSync(
        ffmpegBin,
        ['-y', '-i', inPath, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', outPath],
        { stdio: 'pipe', timeout: 300_000 },
      );
      if (ff.status !== 0) {
        throw new Error(`ffmpeg exited ${ff.status}: ${String(ff.stderr).slice(-300)}`);
      }
      const mp3 = readFileSync(outPath);
      try { unlinkSync(inPath); unlinkSync(outPath); } catch {}
      if (!mp3.length) throw new Error('empty output');

      const mp3Duration = await mp3DurationSeconds(mp3);
      if (duration > 0 && mp3Duration != null && Math.abs(mp3Duration - duration) > 3) {
        throw new Error(
          `duration mismatch: catalog ${duration}s vs mp3 ${Math.round(mp3Duration)}s`,
        );
      }

      const streamPath = path.replace(/\.[^./]+$/, '') + `-stream192-${Date.now()}.mp3`;
      const { error: upErr } = await sb.storage
        .from('songs')
        .upload(streamPath, mp3, { contentType: 'audio/mpeg', upsert: false });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { data: pub } = sb.storage.from('songs').getPublicUrl(streamPath);
      const update = { audio_url: pub.publicUrl };
      if (mp3Duration != null && duration === 0) {
        update.duration_seconds = Math.ceil(mp3Duration);
      }
      const { error: dbErr } = await sb.from('songs').update(update).eq('id', song.id);
      if (dbErr) throw new Error(`db update: ${dbErr.message}`);

      console.log(
        `  -> ${(mp3.length / 1048576).toFixed(1)}MB mp3, duration ok (${mp3Duration != null ? Math.round(mp3Duration) : '?'}s), url updated`,
      );
      converted++;
    } catch (e) {
      console.log(`  FAILED: ${e.message}`);
      failed++;
    }
  }

  console.log('---');
  console.log(`converted: ${converted}, skipped (already fine): ${skipped}, failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
