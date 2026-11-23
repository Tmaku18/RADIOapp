import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getSupabaseClient } from '../config/supabase.config';
import { AdminService } from '../admin/admin.service';

/**
 * Service for cleaning up:
 * - Rejected songs after 48 hours (deletes records and storage files)
 * - Old chat messages after 24 hours (archives to chat_archives table)
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly adminService: AdminService) {}
  private static readonly SUPABASE_PUBLIC_SONGS_MARKER =
    '/storage/v1/object/public/songs/';

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
        this.logger.error(
          `Delete failed after archive: ${deleteError.message}`,
        );
        return;
      }

      this.logger.log(
        `Archived ${archivedCount || 0} chat messages to cold storage`,
      );
    } catch (error) {
      this.logger.error(`Chat archival error: ${error.message}`);
    }
  }

  /**
   * Drop automated radio notices older than 30 days. These are generated on
   * every spin and would otherwise fill the inbox. Runs once a day, one batch
   * at a time, until nothing older than the cutoff remains.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async pruneAutomatedNotifications() {
    this.logger.log('Pruning automated notifications older than 30 days...');

    const supabase = getSupabaseClient();
    let total = 0;

    try {
      for (;;) {
        const { data, error } = await supabase.rpc(
          'prune_automated_notifications',
          { p_older_than: '30 days', p_batch: 50000 },
        );

        if (error) {
          this.logger.error(`Notification prune RPC failed: ${error.message}`);
          return;
        }

        const deleted = typeof data === 'number' ? data : Number(data) || 0;
        total += deleted;
        if (deleted === 0) break;
      }

      this.logger.log(`Pruned ${total} automated notifications`);
    } catch (error) {
      this.logger.error(`Notification prune error: ${error.message}`);
    }
  }

  /**
   * Empty-station advances used to write a decision row on every song.
   * Keep two weeks for debugging and drop the rest.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async prunePlayDecisionLog() {
    const supabase = getSupabaseClient();
    let total = 0;
    try {
      for (;;) {
        const { data, error } = await supabase.rpc('prune_play_decision_log', {
          p_older_than: '14 days',
          p_batch: 20000,
        });
        if (error) {
          this.logger.error(`Play decision prune failed: ${error.message}`);
          return;
        }
        const deleted = typeof data === 'number' ? data : Number(data) || 0;
        total += deleted;
        if (deleted === 0) break;
      }
      this.logger.log(`Pruned ${total} play decision rows`);
    } catch (error) {
      this.logger.error(`Play decision prune error: ${error.message}`);
    }
  }

  /**
   * Permanently delete accounts whose 48-hour recovery window has ended.
   * Signing in before this runs clears the schedule and keeps the data.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeScheduledAccountDeletions() {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .lt('deletion_scheduled_for', now)
      .limit(25);

    if (error) {
      if (/deletion_scheduled_for/i.test(error.message)) {
        this.logger.warn(
          'Account deletion schedule is not available yet; skipping purge',
        );
        return;
      }
      this.logger.error(
        `Failed to list accounts scheduled for deletion: ${error.message}`,
      );
      return;
    }

    if (!data?.length) return;

    for (const row of data) {
      try {
        await this.adminService.deleteUserAccount(row.id);
        this.logger.log(`Permanently deleted account ${row.id} after 48 hours`);
      } catch (err) {
        this.logger.error(
          `Failed to permanently delete account ${row.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
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
      this.logger.error(
        `Failed to fetch rejected songs: ${fetchError.message}`,
      );
      return;
    }

    if (!songsToDelete || songsToDelete.length === 0) {
      this.logger.log('No expired rejected songs to clean up');
      return;
    }

    this.logger.log(
      `Found ${songsToDelete.length} expired rejected songs to delete`,
    );

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

        // Preserve unique "Ears Reached" before the song's listener rows
        // cascade-delete. Best-effort: never block cleanup if this fails.
        const { error: archiveError } = await supabase.rpc('archive_song_ears', {
          p_song_id: song.id,
        });
        if (archiveError) {
          this.logger.warn(
            `Ears archive failed for rejected song ${song.id}: ${archiveError.message}`,
          );
        }

        // Delete database record
        const { error: deleteError } = await supabase
          .from('songs')
          .delete()
          .eq('id', song.id);

        if (deleteError) {
          this.logger.error(
            `Failed to delete song ${song.id}: ${deleteError.message}`,
          );
        } else {
          this.logger.log(`Deleted rejected song: ${song.title} (${song.id})`);
        }
      } catch (error) {
        this.logger.error(
          `Error cleaning up song ${song.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Cleanup complete. Processed ${songsToDelete.length} songs.`,
    );
  }

  /**
   * Auto-quarantine radio entries that point to missing storage objects.
   * Prevents "Audio source not available" incidents caused by stale URLs.
   */
  @Cron('0 */3 * * *')
  async quarantineBrokenRadioAudioSources() {
    this.logger.log('Starting radio audio integrity check...');
    const supabase = getSupabaseClient();

    const [songsRes, fallbackRes] = await Promise.all([
      supabase
        .from('songs')
        .select('id, title, audio_url')
        .eq('status', 'approved'),
      supabase
        .from('admin_fallback_songs')
        .select('id, title, radio_id, audio_url')
        .eq('is_active', true),
    ]);

    if (songsRes.error) {
      this.logger.error(
        `Failed loading approved songs for integrity check: ${songsRes.error.message}`,
      );
      return;
    }
    if (fallbackRes.error) {
      this.logger.error(
        `Failed loading active fallback songs for integrity check: ${fallbackRes.error.message}`,
      );
      return;
    }

    const songs = (songsRes.data ?? []) as Array<{
      id: string;
      title?: string | null;
      audio_url?: string | null;
    }>;
    const fallbackSongs = (fallbackRes.data ?? []) as Array<{
      id: string;
      title?: string | null;
      radio_id?: string | null;
      audio_url?: string | null;
    }>;

    let quarantinedSongs = 0;
    let quarantinedFallback = 0;
    const songPaths = songs
      .map((song) => ({
        song,
        path: this.extractPublicSongsPath(song.audio_url ?? null),
      }))
      .filter((row): row is { song: (typeof songs)[number]; path: string } =>
        !!row.path,
      );
    const fallbackPaths = fallbackSongs
      .map((row) => ({
        row,
        path: this.extractPublicSongsPath(row.audio_url ?? null),
      }))
      .filter(
        (entry): entry is { row: (typeof fallbackSongs)[number]; path: string } =>
          !!entry.path,
      );
    const existing = await this.storageObjectsExist(
      [...songPaths, ...fallbackPaths].map((row) => row.path),
    );

    for (const { song, path } of songPaths) {
      if (existing.has(path)) continue;

      const { error } = await supabase
        .from('songs')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', song.id);

      if (error) {
        this.logger.warn(
          `Failed to quarantine broken song ${song.id}: ${error.message}`,
        );
        continue;
      }

      quarantinedSongs += 1;
      this.logger.warn(
        `Quarantined broken approved song "${song.title ?? song.id}" (${song.id})`,
      );
    }

    for (const { row, path } of fallbackPaths) {
      if (existing.has(path)) continue;

      const { error } = await supabase
        .from('admin_fallback_songs')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('radio_id', row.radio_id ?? '');

      if (error) {
        this.logger.warn(
          `Failed to disable broken fallback ${row.id}: ${error.message}`,
        );
        continue;
      }

      quarantinedFallback += 1;
      this.logger.warn(
        `Disabled broken fallback "${row.title ?? row.id}" (${row.id}) on radio ${row.radio_id ?? 'unknown'}`,
      );
    }

    this.logger.log(
      `Radio audio integrity complete: quarantined songs=${quarantinedSongs}, fallback=${quarantinedFallback}`,
    );
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
      const pathMatch = urlObj.pathname.match(
        /\/storage\/v1\/object\/public\/[^\/]+\/(.+)/,
      );

      if (!pathMatch) {
        this.logger.warn(`Could not extract path from URL: ${url}`);
        return;
      }

      const filePath = pathMatch[1];

      const { error } = await supabase.storage.from(bucket).remove([filePath]);

      if (error) {
        this.logger.warn(
          `Failed to delete file from ${bucket}: ${error.message}`,
        );
      } else {
        this.logger.debug(`Deleted file from ${bucket}: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Error parsing URL for deletion: ${url}`);
    }
  }

  private extractPublicSongsPath(audioUrl: string | null): string | null {
    if (!audioUrl || typeof audioUrl !== 'string') return null;
    const raw = audioUrl.trim();
    if (!raw) return null;
    const marker = CleanupService.SUPABASE_PUBLIC_SONGS_MARKER;
    const markerIndex = raw.indexOf(marker);
    if (markerIndex < 0) return null;
    const remainder = raw.slice(markerIndex + marker.length);
    const path = remainder.split('?')[0].trim();
    return path || null;
  }

  private async storageObjectsExist(paths: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    const unique = [...new Set(paths.filter(Boolean))];
    const supabase = getSupabaseClient();
    const chunkSize = 80;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .schema('storage')
        .from('objects')
        .select('name')
        .eq('bucket_id', 'songs')
        .in('name', chunk);
      if (error) {
        this.logger.warn(
          `Storage existence batch failed: ${error.message}. Leaving those songs alone.`,
        );
        for (const name of chunk) found.add(name);
        continue;
      }
      for (const row of data ?? []) {
        const name = (row as { name?: string }).name;
        if (name) found.add(name);
      }
    }
    return found;
  }

  private async storageObjectExists(path: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .schema('storage')
      .from('objects')
      .select('name')
      .eq('bucket_id', 'songs')
      .eq('name', path)
      .maybeSingle();
    if (error) {
      this.logger.warn(`Storage existence check failed for "${path}"`);
      return true;
    }
    return !!data?.name;
  }
}
