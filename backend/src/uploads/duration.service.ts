import { Injectable, Logger } from '@nestjs/common';
import * as mm from 'music-metadata';

/**
 * Service for extracting audio duration from files.
 * Uses music-metadata library which is fast and reliable.
 *
 * IMPORTANT: This validates the actual audio duration server-side,
 * preventing artists from spoofing metadata to pay less credits.
 */
@Injectable()
export class DurationService {
  private readonly logger = new Logger(DurationService.name);

  /**
   * Extract real duration from a media buffer.
   * Returns duration in seconds (rounded up to nearest second).
   *
   * @param buffer - The media file buffer
   * @param mimeType - Optional MIME type hint for faster parsing
   * @returns Duration in seconds, or default (180) if extraction fails
   *          (legacy song/credit path — prefer {@link extractDurationOrNull}
   *          for hard length gates like Discover feed videos)
   */
  async extractDuration(buffer: Buffer, mimeType?: string): Promise<number> {
    const duration = await this.extractDurationOrNull(buffer, mimeType);
    if (duration != null) return duration;
    this.logger.warn('Duration not found in metadata, using default 180s');
    return 180; // Default 3 minutes (song credit path)
  }

  /**
   * Like {@link extractDuration}, but returns null when duration cannot be
   * read. Camera / mirrored phone videos often lack parseable metadata; callers
   * that enforce a max length must not treat "unknown" as 180s.
   */
  async extractDurationOrNull(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<number | null> {
    try {
      const metadata = await mm.parseBuffer(buffer, { mimeType });

      if (metadata.format.duration) {
        const durationSeconds = Math.ceil(metadata.format.duration);
        this.logger.log(`Extracted duration: ${durationSeconds}s`);
        return durationSeconds;
      }

      this.logger.warn('Duration not found in metadata');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to extract duration: ${message}`);
      return null;
    }
  }

  /**
   * Read the duration of an object already sitting in storage, without pulling
   * the whole thing back into this container.
   *
   * Feed video/audio uploads go straight to storage, so the bytes never pass
   * through here — but length still has to be enforced against something other
   * than the client's word. For MP4-family containers this walks the top-level
   * box table with range requests and downloads only `moov`, which matters
   * because phone recordings put `moov` at the *end* of the file: a head slice
   * would find nothing and streaming to it would pull the entire clip.
   *
   * Returns null when duration cannot be determined. Callers enforcing a cap
   * must treat null as "unknown", never as "over".
   */
  async probeRemoteDurationSeconds(
    url: string,
    options: { mimeType?: string; sizeBytes?: number } = {},
  ): Promise<number | null> {
    const { mimeType, sizeBytes } = options;
    try {
      if (this.isMp4Container(mimeType)) {
        const fromBoxes = await this.probeMp4Duration(url, sizeBytes);
        if (fromBoxes != null) return fromBoxes;
      }
      // WAV/FLAC/OGG/WebM carry duration near the front, and MP3 can be
      // estimated from a leading slice. Cap the read so this stays bounded.
      const head = await this.fetchRange(
        url,
        0,
        Math.min(sizeBytes ?? this.headProbeBytes, this.headProbeBytes) - 1,
      );
      if (!head || head.length === 0) return null;
      return await this.extractDurationOrNull(head, mimeType);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Remote duration probe failed: ${message}`);
      return null;
    }
  }

  private readonly headProbeBytes = 8 * 1024 * 1024;
  private readonly maxMoovBytes = 8 * 1024 * 1024;

  private isMp4Container(mimeType?: string): boolean {
    if (!mimeType) return false;
    return [
      'video/mp4',
      'video/quicktime',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4a',
    ].includes(mimeType.toLowerCase());
  }

  /** Walk top-level boxes over HTTP ranges and parse only `moov`. */
  private async probeMp4Duration(
    url: string,
    sizeBytes?: number,
  ): Promise<number | null> {
    let offset = 0;
    // Plenty for ftyp/free/mdat/moov ordering; stops a malformed file looping.
    for (let hops = 0; hops < 32; hops++) {
      const header = await this.fetchRange(url, offset, offset + 15);
      if (!header || header.length < 8) return null;

      let boxSize = header.readUInt32BE(0);
      const type = header.subarray(4, 8).toString('latin1');
      let headerSize = 8;

      if (boxSize === 1) {
        // 64-bit size: real for >4GB `mdat`, which phone video can reach.
        if (header.length < 16) return null;
        const large = header.readBigUInt64BE(8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        boxSize = Number(large);
        headerSize = 16;
      } else if (boxSize === 0) {
        // Box runs to end of file.
        boxSize = sizeBytes != null ? sizeBytes - offset : 0;
      }
      if (boxSize < headerSize) return null;

      if (type === 'moov') {
        const moov = await this.fetchRange(
          url,
          offset,
          offset + Math.min(boxSize, this.maxMoovBytes) - 1,
        );
        if (!moov) return null;
        return this.durationFromMoov(moov);
      }

      offset += boxSize;
      if (sizeBytes != null && offset >= sizeBytes) return null;
    }
    return null;
  }

  /** Pull timescale + duration out of `moov` → `mvhd`. */
  private durationFromMoov(moov: Buffer): number | null {
    let offset = 8;
    while (offset + 8 <= moov.length) {
      const boxSize = moov.readUInt32BE(offset);
      const type = moov.subarray(offset + 4, offset + 8).toString('latin1');
      if (boxSize < 8) return null;

      if (type === 'mvhd') {
        const body = offset + 8;
        if (body >= moov.length) return null;
        const version = moov[body];
        let timescale: number;
        let duration: number;
        if (version === 1) {
          if (body + 32 > moov.length) return null;
          timescale = moov.readUInt32BE(body + 20);
          duration = Number(moov.readBigUInt64BE(body + 24));
        } else {
          if (body + 20 > moov.length) return null;
          timescale = moov.readUInt32BE(body + 12);
          duration = moov.readUInt32BE(body + 16);
        }
        if (!timescale || duration <= 0) return null;
        const seconds = Math.ceil(duration / timescale);
        this.logger.log(`Probed remote duration: ${seconds}s`);
        return seconds;
      }
      offset += boxSize;
    }
    return null;
  }

  /**
   * Fetch a byte range. Bails out when the host ignores `Range` and offers the
   * whole object instead, so a probe can never turn into a 1GB download.
   */
  private async fetchRange(
    url: string,
    start: number,
    endInclusive: number,
  ): Promise<Buffer | null> {
    if (endInclusive < start) return null;
    const wanted = endInclusive - start + 1;
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${endInclusive}` },
    });

    if (response.status === 200) {
      const length = Number(response.headers.get('content-length') ?? '0');
      if (length > wanted + this.headProbeBytes) {
        await response.body?.cancel();
        this.logger.warn('Storage ignored Range; skipping duration probe.');
        return null;
      }
      const full = Buffer.from(await response.arrayBuffer());
      return full.subarray(start, endInclusive + 1);
    }
    if (response.status !== 206) {
      await response.body?.cancel();
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Calculate credits required for a given duration.
   * Formula: ceil(duration_seconds / 5)
   *
   * @param durationSeconds - Song duration in seconds
   * @returns Number of credits required for one full play
   */
  calculateCreditsForPlay(durationSeconds: number): number {
    return Math.ceil(durationSeconds / 5);
  }
}
