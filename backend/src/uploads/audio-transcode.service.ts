import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

/**
 * Normalizes uploaded audio into a streaming-friendly format.
 *
 * Artists upload whatever their DAW exports — often raw WAV/AIFF at
 * 1.4–3 Mbps. Radio listeners then have to stream those bytes in real time,
 * which stalls on any cellular connection and produces the "song freezes,
 * then skips" experience. Everything served to the radio should be lossy
 * ~192 kbps, so a track never needs more than ~0.2 Mbps of sustained
 * bandwidth.
 *
 * The original upload is never deleted; callers keep or discard it as they
 * see fit. This service only answers "does this need a transcode?" and
 * produces the MP3 bytes.
 */
@Injectable()
export class AudioTranscodeService {
  private readonly logger = new Logger(AudioTranscodeService.name);
  private readonly ffmpegConfigured: boolean;

  /**
   * Anything above this effective bitrate is treated as not-streamable.
   * 320 kbps MP3s are fine; WAV (1411+) and 24-bit masters (2300+) are not.
   * 400 leaves headroom so a legitimate 320 kbps file is never re-encoded.
   */
  private static readonly MAX_STREAM_KBPS = 400;

  private static readonly LOSSLESS_HINTS = [
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/aiff',
    'audio/x-aiff',
    'audio/flac',
    'audio/x-flac',
  ];

  constructor() {
    const configuredPath = (process.env.FFMPEG_PATH || '').trim();
    const bundledPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
    // Prefer system ffmpeg (Alpine Dockerfile installs `/usr/bin/ffmpeg`).
    // `ffmpeg-static` is often a glibc binary and fails on musl.
    const systemPath = existsSync('/usr/bin/ffmpeg')
      ? '/usr/bin/ffmpeg'
      : existsSync('/usr/local/bin/ffmpeg')
        ? '/usr/local/bin/ffmpeg'
        : '';
    const ffmpegPath = configuredPath || systemPath || bundledPath;
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
      this.ffmpegConfigured = true;
    } else {
      this.ffmpegConfigured = false;
      this.logger.warn(
        'FFmpeg is not configured; lossless uploads will be stored as-is',
      );
    }
  }

  /**
   * Should these bytes be re-encoded before they are streamed to listeners?
   */
  needsStreamTranscode(params: {
    contentType?: string | null;
    sizeBytes: number;
    durationSeconds?: number | null;
  }): boolean {
    const ct = (params.contentType ?? '').toLowerCase();
    if (AudioTranscodeService.LOSSLESS_HINTS.some((h) => ct.includes(h))) {
      return true;
    }
    const duration = Number(params.durationSeconds ?? 0);
    if (duration > 0 && params.sizeBytes > 0) {
      const kbps = (params.sizeBytes * 8) / duration / 1000;
      if (kbps > AudioTranscodeService.MAX_STREAM_KBPS) return true;
    }
    return false;
  }

  /**
   * Re-encode arbitrary audio to 192 kbps MP3.
   *
   * Returns null when ffmpeg is unavailable or the encode fails — callers
   * must fall back to the original bytes rather than blocking the upload.
   */
  async transcodeToStreamMp3(buffer: Buffer): Promise<Buffer | null> {
    if (!this.ffmpegConfigured) return null;

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = join(tmpdir(), `stream-in-${runId}.bin`);
    const outputPath = join(tmpdir(), `stream-out-${runId}.mp3`);

    try {
      await fs.writeFile(inputPath, buffer);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .format('mp3')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });
      const out = await fs.readFile(outputPath);
      if (!out.length) return null;
      this.logger.log(
        `Transcoded ${(buffer.length / 1048576).toFixed(1)}MB -> ${(out.length / 1048576).toFixed(1)}MB MP3 192k`,
      );
      return out;
    } catch (error) {
      this.logger.error(
        `Stream transcode failed, keeping original: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
  }
}
