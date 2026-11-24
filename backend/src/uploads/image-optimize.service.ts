import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

export type ImageOptimizeKind = 'avatar' | 'artwork' | 'general';

const MAX_EDGE: Record<ImageOptimizeKind, number> = {
  avatar: 512,
  artwork: 1200,
  general: 1600,
};

/**
 * Resize server-uploaded images to WebP. Callers keep the original bytes
 * when sharp cannot decode the file.
 */
@Injectable()
export class ImageOptimizeService {
  private readonly logger = new Logger(ImageOptimizeService.name);

  async optimize(
    buffer: Buffer,
    kind: ImageOptimizeKind,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string } | null> {
    try {
      const optimized = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: MAX_EDGE[kind],
          height: MAX_EDGE[kind],
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      if (!optimized.length) return null;
      return { buffer: optimized, contentType: 'image/webp', extension: 'webp' };
    } catch (error) {
      this.logger.warn(
        `Image optimize skipped: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
