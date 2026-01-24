import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getSupabaseClient } from '../config/supabase.config';

/**
 * Service for cleaning up:
 * - Rejected songs after 48 hours (deletes records and storage files)
 * - Old chat messages after 24 hours (archives to chat_archives table)
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  /**
   * Archive old chat messages (preserves business value for artist sentiment analysis)
   * Runs every hour, moves messages older than 24 hours to chat_archives table
   */
  @Cron(CronExpression.EVERY_HOUR)
  async archiveOldChatMessages() {
    this.logger.log('Starting chat message archival...');

    const supabase = getSupabaseClient();
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    try {
      // Step 1: Call RPC function to archive messages atomically
      const { data: archivedCount, error: archiveError } = await supabase.rpc(
        'archive_old_chat_messages',
        { cutoff_timestamp: cutoffTime.toISOString() },
      );

      if (archiveError) {
        this.logger.error(`Archive RPC failed: ${archiveError.message}`);
        return;
      }

      // Step 2: Delete the archived messages from live table
      const { error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .lt('created_at', cutoffTime.toISOString());

      if (deleteError) {
        this.logger.error(`Delete failed after archive: ${deleteError.message}`);
        return;
      }

      this.logger.log(`Archived ${archivedCount || 0} chat messages to cold storage`);
    } catch (error) {
      this.logger.error(`Chat archival error: ${error.message}`);
    }
  }

  /**
   * Run cleanup every hour to check for expired rejected songs.
   * Songs rejected more than 48 hours ago will be permanently deleted.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupRejectedSongs() {
    this.logger.log('Starting rejected songs cleanup...');

    const supabase = getSupabaseClient();
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    // Get songs to delete
    const { data: songsToDelete, error: fetchError } = await supabase
      .from('songs')
      .select('id, audio_url, artwork_url, title')
      .eq('status', 'rejected')
      .lt('rejected_at', cutoffTime.toISOString());

    if (fetchError) {
      this.logger.error(`Failed to fetch rejected songs: ${fetchError.message}`);
      return;
    }

    if (!songsToDelete || songsToDelete.length === 0) {
      this.logger.log('No expired rejected songs to clean up');
      return;
    }

    this.logger.log(`Found ${songsToDelete.length} expired rejected songs to delete`);

    for (const song of songsToDelete) {
      try {
        // Delete audio file from storage
        if (song.audio_url) {
          await this.deleteFromStorage('songs', song.audio_url);
        }

        // Delete artwork from storage
        if (song.artwork_url) {
          await this.deleteFromStorage('artwork', song.artwork_url);
        }

        // Delete database record
        const { error: deleteError } = await supabase
          .from('songs')
          .delete()
          .eq('id', song.id);

        if (deleteError) {
          this.logger.error(`Failed to delete song ${song.id}: ${deleteError.message}`);
        } else {
          this.logger.log(`Deleted rejected song: ${song.title} (${song.id})`);
        }
      } catch (error) {
        this.logger.error(`Error cleaning up song ${song.id}: ${error.message}`);
      }
    }

    this.logger.log(`Cleanup complete. Processed ${songsToDelete.length} songs.`);
  }

  /**
   * Extract storage path from URL and delete the file.
   */
  private async deleteFromStorage(bucket: string, url: string) {
    const supabase = getSupabaseClient();

    try {
      // Extract the path from the URL
      // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)/);
      
      if (!pathMatch) {
        this.logger.warn(`Could not extract path from URL: ${url}`);
        return;
      }

      const filePath = pathMatch[1];

      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        this.logger.warn(`Failed to delete file from ${bucket}: ${error.message}`);
      } else {
        this.logger.debug(`Deleted file from ${bucket}: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Error parsing URL for deletion: ${url}`);
    }
  }
}
