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
   * Extract real duration from audio file buffer.
   * Returns duration in seconds (rounded up to nearest second).
   * 
   * @param buffer - The audio file buffer
   * @param mimeType - Optional MIME type hint for faster parsing
   * @returns Duration in seconds, or default (180) if extraction fails
   */
  async extractDuration(buffer: Buffer, mimeType?: string): Promise<number> {
    try {
      const metadata = await mm.parseBuffer(buffer, { mimeType });
      
      if (metadata.format.duration) {
        const durationSeconds = Math.ceil(metadata.format.duration);
        this.logger.log(`Extracted duration: ${durationSeconds}s`);
        return durationSeconds;
      }

      this.logger.warn('Duration not found in metadata, using default');
      return 180; // Default 3 minutes
    } catch (error) {
      this.logger.error(`Failed to extract duration: ${error.message}`);
      return 180; // Default 3 minutes on error
    }
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
