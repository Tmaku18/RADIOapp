import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { signSongAudioUrl } from '../common/song-audio.util';
import { AdminService } from '../admin/admin.service';
import {
  AcrCloudProvider,
  CopyrightMatch,
  CopyrightScanResult,
} from './acrcloud.provider';

export type CopyrightStatus =
  | 'pending'
  | 'checking'
  | 'clear'
  | 'flagged'
  | 'error'
  | 'skipped';

/**
 * Screens uploaded songs for copyright infringement.
 *
 * On upload, {@link queueCheck} runs a non-blocking background scan: it
 * downloads the stored audio, fingerprints it via the configured provider
 * (ACRCloud), and records the outcome on the song. When a high-confidence
 * match against a commercial recording is found, the song is auto-rejected
 * and the artist is notified (reusing the admin rejection flow, which also
 * sends the rejection email and starts the 48h cleanup window).
 */
@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);
  private readonly enabled: boolean;
  /** Minimum provider confidence (0-100) to treat a match as infringement. */
  private readonly matchThreshold: number;
  // Guard against downloading absurdly large files into memory.
  private readonly maxDownloadBytes = 105 * 1024 * 1024;

  constructor(
    private readonly configService: ConfigService,
    private readonly acrcloud: AcrCloudProvider,
    private readonly adminService: AdminService,
  ) {
    this.enabled =
      (this.configService.get<string>('COPYRIGHT_CHECK_ENABLED') ?? 'true')
        .toLowerCase() !== 'false';
    const threshold = Number(
      this.configService.get<string>('COPYRIGHT_MATCH_THRESHOLD'),
    );
    this.matchThreshold =
      Number.isFinite(threshold) && threshold > 0 ? threshold : 80;
  }

  /**
   * Fire-and-forget entry point used by the upload flow. Never throws and
   * never blocks the caller — failures only affect the screening status.
   */
  queueCheck(songId: string, audioUrl: string | null | undefined): void {
    if (!songId || !audioUrl) return;

    setImmediate(() => {
      void this.runCheck(songId, audioUrl).catch((err) => {
        this.logger.error(
          `Copyright check crashed for song ${songId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    });
  }

  /**
   * Run the full screening pipeline for one song. Safe to call directly
   * (e.g. from an admin "re-check" action). Resolves with the final status.
   */
  async runCheck(
    songId: string,
    audioUrl: string,
  ): Promise<CopyrightStatus> {
    if (!this.enabled) {
      await this.persistStatus(songId, 'skipped', null);
      return 'skipped';
    }

    if (!this.acrcloud.isConfigured()) {
      this.logger.warn(
        `Copyright provider not configured; skipping check for song ${songId}`,
      );
      await this.persistStatus(songId, 'skipped', null);
      return 'skipped';
    }

    await this.persistStatus(songId, 'checking', null);

    let result: CopyrightScanResult;
    try {
      const audio = await this.downloadAudio(audioUrl);
      result = await this.acrcloud.scan(audio);
    } catch (err) {
      this.logger.error(
        `Copyright scan failed for song ${songId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Leave as "error" for retry/manual review; do not block publishing.
      await this.persistStatus(songId, 'error', null);
      return 'error';
    }

    const infringing =
      result.matched &&
      result.bestMatch != null &&
      result.bestMatch.score >= this.matchThreshold;

    if (infringing && result.bestMatch) {
      await this.persistStatus(songId, 'flagged', result.bestMatch);
      await this.rejectInfringingSong(songId, result.bestMatch);
      return 'flagged';
    }

    await this.persistStatus(songId, 'clear', result.bestMatch);
    return 'clear';
  }

  private async downloadAudio(audioUrl: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      // The full track lives in the private `songs` bucket; sign before fetch.
      const signedUrl = (await signSongAudioUrl(audioUrl)) ?? audioUrl;
      const res = await fetch(signedUrl, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(
          `Failed to download audio: ${res.status} ${res.statusText}`,
        );
      }
      const contentLength = res.headers.get('content-length');
      if (contentLength) {
        const bytes = Number(contentLength);
        if (Number.isFinite(bytes) && bytes > this.maxDownloadBytes) {
          throw new Error(`Audio too large to screen (${bytes} bytes)`);
        }
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) {
        throw new Error('Downloaded audio is empty');
      }
      return buf;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Auto-reject a flagged song and notify the artist. Reuses the admin
   * status flow so notification + email + 48h cleanup behaviour stay
   * consistent with manual rejections.
   */
  private async rejectInfringingSong(
    songId: string,
    match: CopyrightMatch,
  ): Promise<void> {
    const reason = this.buildRejectionReason(match);
    try {
      await this.adminService.updateSongStatus(songId, 'rejected', reason);
      this.logger.warn(
        `Auto-rejected song ${songId} for copyright match: ${reason}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to auto-reject flagged song ${songId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private buildRejectionReason(match: CopyrightMatch): string {
    const artist = match.artists.length ? match.artists.join(', ') : 'unknown';
    const title = match.title ?? 'an existing recording';
    return `Possible copyright match detected: "${title}" by ${artist} (confidence ${Math.round(
      match.score,
    )}%). If you own or have rights to this recording, contact support to appeal.`;
  }

  private async persistStatus(
    songId: string,
    status: CopyrightStatus,
    match: CopyrightMatch | null,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const update: Record<string, unknown> = {
      copyright_status: status,
    };
    // Stamp completion time only for terminal states.
    if (status !== 'checking') {
      update.copyright_checked_at = new Date().toISOString();
      update.copyright_match = match ?? null;
    }

    const { error } = await supabase
      .from('songs')
      .update(update)
      .eq('id', songId);

    if (error) {
      // Tolerate environments where the migration has not been applied yet.
      if (this.isMissingColumnError(error)) {
        this.logger.warn(
          `Copyright columns missing on songs table; skipping status persist for ${songId}`,
        );
        return;
      }
      this.logger.error(
        `Failed to persist copyright status for song ${songId}: ${error.message}`,
      );
    }
  }

  private isMissingColumnError(error: {
    message?: string;
    code?: string;
  }): boolean {
    const msg = (error?.message ?? '').toLowerCase();
    return (
      error?.code === '42703' ||
      (msg.includes('column') && msg.includes('copyright'))
    );
  }
}
