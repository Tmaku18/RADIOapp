import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * A single commercial recording matched against the uploaded audio.
 */
export interface CopyrightMatch {
  title: string | null;
  artists: string[];
  album: string | null;
  label: string | null;
  /** Provider confidence 0-100 that the sample matches this recording. */
  score: number;
  /** External catalogue ids (ISRC, UPC, Spotify, etc.) when available. */
  externalIds: Record<string, unknown>;
  provider: string;
}

export interface CopyrightScanResult {
  /** True when the provider returned at least one commercial match. */
  matched: boolean;
  /** Highest-confidence match, when matched. */
  bestMatch: CopyrightMatch | null;
  /** All matches returned by the provider. */
  matches: CopyrightMatch[];
  /** Raw provider response, persisted for auditing/appeals. */
  raw: unknown;
  provider: string;
}

interface AcrCloudMusicEntry {
  title?: string;
  score?: number;
  album?: { name?: string };
  label?: string;
  artists?: Array<{ name?: string }>;
  external_ids?: Record<string, unknown>;
  external_metadata?: Record<string, unknown>;
}

/**
 * ACRCloud "Identify" provider.
 *
 * Sends a short sample of the uploaded audio to ACRCloud's recognition API,
 * which fingerprints it against a database of commercial recordings. A match
 * means the upload is (or contains) a known copyrighted track.
 *
 * Required env:
 *   ACRCLOUD_HOST           e.g. identify-us-west-2.acrcloud.com
 *   ACRCLOUD_ACCESS_KEY
 *   ACRCLOUD_ACCESS_SECRET
 */
@Injectable()
export class AcrCloudProvider {
  readonly name = 'acrcloud';
  private readonly logger = new Logger(AcrCloudProvider.name);
  private readonly host: string;
  private readonly accessKey: string;
  private readonly accessSecret: string;
  // ACRCloud only needs the first few seconds; cap the sample to keep the
  // request small and fast. ~1MB comfortably covers the 10-12s they recommend.
  private readonly maxSampleBytes = 1_000_000;
  private readonly endpoint = '/v1/identify';

  constructor(private readonly configService: ConfigService) {
    this.host = (this.configService.get<string>('ACRCLOUD_HOST') || '').trim();
    this.accessKey = (
      this.configService.get<string>('ACRCLOUD_ACCESS_KEY') || ''
    ).trim();
    this.accessSecret = (
      this.configService.get<string>('ACRCLOUD_ACCESS_SECRET') || ''
    ).trim();
  }

  /** Whether the provider has the credentials it needs to run. */
  isConfigured(): boolean {
    return Boolean(this.host && this.accessKey && this.accessSecret);
  }

  /**
   * Fingerprint an audio buffer and report any commercial matches.
   * `audioBuffer` may be the whole file; only the leading sample is sent.
   */
  async scan(audioBuffer: Buffer): Promise<CopyrightScanResult> {
    if (!this.isConfigured()) {
      throw new Error('ACRCloud provider is not configured');
    }

    const sample = audioBuffer.subarray(
      0,
      Math.min(audioBuffer.length, this.maxSampleBytes),
    );

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.buildSignature(timestamp);

    const form = new FormData();
    form.append('access_key', this.accessKey);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('sample_bytes', sample.length.toString());
    form.append('timestamp', timestamp);
    form.append(
      'sample',
      // Copy into a fresh Uint8Array so the typed-array buffer is a plain
      // ArrayBuffer (Node's Buffer can be backed by a SharedArrayBuffer).
      new Blob([new Uint8Array(sample)], {
        type: 'application/octet-stream',
      }),
      'sample',
    );

    const url = `https://${this.host}${this.endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let json: any;
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `ACRCloud returned non-JSON response (${res.status}): ${text.slice(0, 200)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    return this.parseResponse(json);
  }

  /**
   * HMAC-SHA1 signature per ACRCloud's signing scheme.
   * stringToSign = METHOD\nURI\nACCESS_KEY\nDATA_TYPE\nSIGNATURE_VERSION\nTIMESTAMP
   */
  private buildSignature(timestamp: string): string {
    const stringToSign = [
      'POST',
      this.endpoint,
      this.accessKey,
      'audio',
      '1',
      timestamp,
    ].join('\n');

    return crypto
      .createHmac('sha1', this.accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');
  }

  private parseResponse(json: any): CopyrightScanResult {
    const statusCode = json?.status?.code;

    // 1001 = "No result" — a clean, unmatched track.
    if (statusCode === 1001) {
      return {
        matched: false,
        bestMatch: null,
        matches: [],
        raw: json,
        provider: this.name,
      };
    }

    // Anything other than success (0) or no-result is a provider-side error.
    if (statusCode !== 0) {
      const msg = json?.status?.msg || 'Unknown ACRCloud error';
      throw new Error(`ACRCloud error ${statusCode}: ${msg}`);
    }

    const musicEntries: AcrCloudMusicEntry[] = Array.isArray(
      json?.metadata?.music,
    )
      ? json.metadata.music
      : [];

    const matches: CopyrightMatch[] = musicEntries.map((entry) => ({
      title: entry.title ?? null,
      artists: Array.isArray(entry.artists)
        ? entry.artists
            .map((a) => a?.name)
            .filter((n): n is string => Boolean(n))
        : [],
      album: entry.album?.name ?? null,
      label: entry.label ?? null,
      score: typeof entry.score === 'number' ? entry.score : 0,
      externalIds: {
        ...(entry.external_ids ?? {}),
        ...(entry.external_metadata ?? {}),
      },
      provider: this.name,
    }));

    matches.sort((a, b) => b.score - a.score);

    return {
      matched: matches.length > 0,
      bestMatch: matches[0] ?? null,
      matches,
      raw: json,
      provider: this.name,
    };
  }
}
