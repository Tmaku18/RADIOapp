import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google Cloud Vision SafeSearch likelihood values, in ascending severity.
 * https://cloud.google.com/vision/docs/detecting-safe-search
 */
const LIKELIHOOD_ORDER = [
  'UNKNOWN',
  'VERY_UNLIKELY',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'VERY_LIKELY',
] as const;

type Likelihood = (typeof LIKELIHOOD_ORDER)[number];

type SafeSearchAnnotation = {
  adult?: Likelihood;
  violence?: Likelihood;
  racy?: Likelihood;
  medical?: Likelihood;
  spoof?: Likelihood;
};

function likelihoodAtLeast(
  value: Likelihood | undefined,
  threshold: Likelihood,
): boolean {
  if (!value) return false;
  return LIKELIHOOD_ORDER.indexOf(value) >= LIKELIHOOD_ORDER.indexOf(threshold);
}

export type ImageModerationVerdict = {
  allowed: boolean;
  /** Human-readable category when blocked (e.g. "nudity / sexual content"). */
  blockedFor?: string;
};

/**
 * Screens user-uploaded pictures for privacy-policy violations (nudity /
 * sexual content, graphic violence) using Google Cloud Vision SafeSearch via
 * its REST endpoint — called with the built-in fetch, so no SDK dependency.
 *
 * Mirrors the ACRCloud copyright pattern: enabled by default, but when the
 * API key is missing the check is skipped (logged) so environments without
 * the key keep working. Provider outages fail open so uploads don't break,
 * while genuine policy hits throw a BadRequestException at the call site.
 */
@Injectable()
export class ImageModerationService {
  private readonly logger = new Logger(ImageModerationService.name);
  private readonly enabled: boolean;
  private readonly apiKey: string;
  /** Guard against downloading absurdly large images into memory. */
  private readonly maxDownloadBytes = 16 * 1024 * 1024;
  private readonly requestTimeoutMs = 10_000;

  constructor(private readonly configService: ConfigService) {
    this.enabled =
      (this.configService.get<string>('IMAGE_MODERATION_ENABLED') ?? 'true')
        .toLowerCase() !== 'false';
    this.apiKey = (
      this.configService.get<string>('GOOGLE_VISION_API_KEY') || ''
    ).trim();
  }

  isConfigured(): boolean {
    return this.enabled && this.apiKey.length > 0;
  }

  /**
   * Throws a BadRequestException when the image (raw bytes) violates the
   * content policy. No-op when moderation is not configured.
   */
  async assertImageBufferAllowed(
    buffer: Buffer,
    contextLabel: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logSkipped(contextLabel);
      return;
    }
    const verdict = await this.checkImage({
      content: buffer.toString('base64'),
    });
    this.assertAllowed(verdict, contextLabel);
  }

  /**
   * Throws a BadRequestException when the image at a (publicly reachable)
   * URL violates the content policy. Used for direct-to-storage uploads that
   * only register a URL/path with the backend.
   */
  async assertImageUrlAllowed(
    url: string | null | undefined,
    contextLabel: string,
  ): Promise<void> {
    if (!url) return;
    if (!this.isConfigured()) {
      this.logSkipped(contextLabel);
      return;
    }
    // Download ourselves instead of Vision's imageUri fetch: it gives us a
    // size cap and works the same for any storage host.
    const bytes = await this.downloadImage(url);
    if (!bytes) return; // fail open on unreachable media
    const verdict = await this.checkImage({ content: bytes.toString('base64') });
    this.assertAllowed(verdict, contextLabel);
  }

  private assertAllowed(
    verdict: ImageModerationVerdict,
    contextLabel: string,
  ): void {
    if (verdict.allowed) return;
    this.logger.warn(
      `Blocked ${contextLabel} upload: flagged for ${verdict.blockedFor}`,
    );
    throw new BadRequestException(
      `This ${contextLabel.toLowerCase()} appears to contain ${verdict.blockedFor}, which our privacy policy does not allow. Please choose a different picture.`,
    );
  }

  /**
   * Calls Vision SafeSearch. Fails open (allowed) on provider/network errors
   * so an outage never blocks legitimate uploads; only real policy hits block.
   */
  private async checkImage(image: {
    content?: string;
    source?: { imageUri: string };
  }): Promise<ImageModerationVerdict> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              { image, features: [{ type: 'SAFE_SEARCH_DETECTION' }] },
            ],
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.error(
          `Vision SafeSearch request failed (${res.status}); allowing upload`,
        );
        return { allowed: true };
      }

      const body = (await res.json()) as {
        responses?: Array<{
          safeSearchAnnotation?: SafeSearchAnnotation;
          error?: { message?: string };
        }>;
      };
      const first = body.responses?.[0];
      if (!first || first.error || !first.safeSearchAnnotation) {
        this.logger.error(
          `Vision SafeSearch returned no annotation (${first?.error?.message ?? 'empty response'}); allowing upload`,
        );
        return { allowed: true };
      }

      return this.evaluate(first.safeSearchAnnotation);
    } catch (err) {
      this.logger.error(
        `Vision SafeSearch call crashed: ${err instanceof Error ? err.message : String(err)}; allowing upload`,
      );
      return { allowed: true };
    }
  }

  /**
   * Blocking policy: explicit nudity/sexual content and graphic violence are
   * blocked at LIKELY+, suggestive ("racy") content only at VERY_LIKELY so
   * ordinary artist photos and album art don't get false-flagged.
   */
  private evaluate(a: SafeSearchAnnotation): ImageModerationVerdict {
    if (likelihoodAtLeast(a.adult, 'LIKELY')) {
      return { allowed: false, blockedFor: 'nudity or sexual content' };
    }
    if (likelihoodAtLeast(a.violence, 'LIKELY')) {
      return { allowed: false, blockedFor: 'graphic violence' };
    }
    if (likelihoodAtLeast(a.racy, 'VERY_LIKELY')) {
      return { allowed: false, blockedFor: 'sexually suggestive content' };
    }
    return { allowed: true };
  }

  private async downloadImage(url: string): Promise<Buffer | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        this.logger.warn(
          `Could not download image for moderation (${res.status}): ${url}`,
        );
        return null;
      }
      const contentLength = Number(res.headers.get('content-length') ?? 0);
      if (contentLength > this.maxDownloadBytes) {
        this.logger.warn(
          `Skipping moderation for oversized image (${contentLength} bytes): ${url}`,
        );
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > this.maxDownloadBytes) return null;
      return Buffer.from(arrayBuffer);
    } catch (err) {
      this.logger.warn(
        `Image download for moderation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private logSkipped(contextLabel: string): void {
    if (!this.enabled) return;
    this.logger.warn(
      `Image moderation not configured (GOOGLE_VISION_API_KEY missing); skipping check for ${contextLabel}`,
    );
  }
}
