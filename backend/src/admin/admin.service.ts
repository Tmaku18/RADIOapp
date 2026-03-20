import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { getFirebaseAuth } from '../config/firebase.config';
import { EmailService } from '../email/email.service';
import { RadioService } from '../radio/radio.service';
import {
  normalizeSongStationId,
  STATION_IDS,
} from '../radio/station.constants';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface BanResult {
  success: boolean;
  userId: string;
  banType: 'hard' | 'shadow';
  tokenRevoked: boolean;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly ffmpegConfigured: boolean;

  constructor(
    private readonly emailService: EmailService,
    private readonly radioService: RadioService,
  ) {
    const configuredPath = (process.env.FFMPEG_PATH || '').trim();
    const bundledPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
    const ffmpegPath = configuredPath || bundledPath;
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
      this.ffmpegConfigured = true;
    } else {
      this.ffmpegConfigured = false;
    }
  }

  async getRadioQueueDebug(radioId: string, limit: number) {
    return this.radioService.getQueueDebug(limit, radioId);
  }

  async getRadioQueue(radioId: string, limit: number) {
    return this.radioService.getAdminQueueState(radioId, limit);
  }

  async addRadioQueueEntries(
    radioId: string,
    payload: {
      items: Array<{
        stackId?: string;
        songId?: string;
        source?: 'songs' | 'admin_fallback';
      }>;
      position?: number;
      allowDuplicates?: boolean;
    },
  ) {
    return this.radioService.addAdminQueueEntries(radioId, payload);
  }

  async replaceRadioQueue(radioId: string, stackIds: string[]) {
    return this.radioService.replaceAdminQueue(radioId, stackIds);
  }

  async removeRadioQueueEntry(
    radioId: string,
    params: {
      position?: number;
      stackId?: string;
      songId?: string;
      source?: 'songs' | 'admin_fallback';
    },
  ) {
    return this.radioService.removeAdminQueueEntry(radioId, params);
  }

  async getSongsPendingApproval(filters: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();

    let query = supabase.from('songs').select(`
        *,
        users:artist_id (
          id,
          email,
          display_name
        )
      `);

    // Only filter by status if explicitly provided and NOT 'all'
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    // If no status specified, default to pending for backwards compatibility
    else if (!filters.status) {
      query = query.eq('status', 'pending');
    }
    // When status is 'all', no filter is applied

    // Search by title or artist name
    if (filters.search && filters.search.trim()) {
      query = query.ilike('title', `%${filters.search.trim()}%`);
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'asc';
    const ascending = sortOrder === 'asc';

    // Map frontend sort keys to database columns
    const sortColumnMap: Record<string, string> = {
      title: 'title',
      artist: 'title', // Will sort by title as artist is joined
      created_at: 'created_at',
      status: 'status',
    };
    const sortColumn = sortColumnMap[sortBy] || 'created_at';

    query = query.order(sortColumn, { ascending });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(`Failed to fetch songs: ${error.message}`);
    }

    return data;
  }

  async updateSongStatus(
    songId: string,
    status: 'pending' | 'approved' | 'rejected',
    reason?: string,
    adminId?: string,
  ) {
    const supabase = getSupabaseClient();

    // Get song with artist info
    const { data: existingSong, error: fetchError } = await supabase
      .from('songs')
      .select(
        'id, status, title, artist_id, users:artist_id(id, email, display_name)',
      )
      .eq('id', songId)
      .single();

    if (fetchError || !existingSong) {
      throw new NotFoundException('Song not found');
    }

    const previousStatus = existingSong.status;
    const now = new Date().toISOString();

    // Build update object with audit columns
    const updateData: any = {
      status,
      updated_at: now,
      status_changed_at: now,
      status_changed_by: adminId || null,
      status_change_reason: reason || null,
    };

    if (status === 'rejected') {
      updateData.rejection_reason = reason || null;
      updateData.rejected_at = now;
      updateData.admin_free_rotation = false;
    } else if (status === 'pending') {
      // Clear rejection fields when reverting to pending
      updateData.rejection_reason = null;
      updateData.rejected_at = null;
      updateData.admin_free_rotation = false;
    } else if (status === 'approved') {
      // Admin approval now instantly places the song in free rotation.
      updateData.admin_free_rotation = true;
    }

    // Update the song status
    const { data, error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update song status: ${error.message}`,
      );
    }

    // Only send notifications if status actually changed
    if (previousStatus !== status) {
      // Create notification for artist
      let notificationType: string;
      let notificationTitle: string;
      let notificationMessage: string;

      if (status === 'approved') {
        notificationType = 'song_approved';
        notificationTitle = 'Song Approved!';
        notificationMessage = `Your song "${existingSong.title}" has been approved and is now live!`;
      } else if (status === 'rejected') {
        notificationType = 'song_rejected';
        notificationTitle = 'Song Rejected';
        notificationMessage = `Your song "${existingSong.title}" was not approved.${reason ? ` Reason: ${reason}` : ''} You have 48 hours to contact support.`;
      } else {
        notificationType = 'song_status_changed';
        notificationTitle = 'Song Status Updated';
        notificationMessage = `Your song "${existingSong.title}" has been moved back to pending review.`;
      }

      await supabase.from('notifications').insert({
        user_id: existingSong.artist_id,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          songId,
          songTitle: existingSong.title,
          previousStatus,
          newStatus: status,
          reason: reason || null,
        },
      });

      this.logger.log(
        `Song ${songId} status changed: ${previousStatus} -> ${status}`,
      );

      // Send email notification for approve/reject
      const artistEmail = (existingSong.users as any)?.email;
      if (artistEmail) {
        if (status === 'approved') {
          await this.emailService.sendSongApprovedEmail(
            artistEmail,
            existingSong.title,
          );
        } else if (status === 'rejected') {
          await this.emailService.sendSongRejectedEmail(
            artistEmail,
            existingSong.title,
            reason,
          );
        }
      }
    }

    return data;
  }

  /**
   * Update song metadata (admin-only): title, station, and artwork URL.
   */
  async updateSongMetadata(
    songId: string,
    dto: {
      title?: string;
      stationId?: string;
      stationIds?: string[];
      artworkUrl?: string | null;
    },
  ) {
    const supabase = getSupabaseClient();

    const { data: existingSong, error: fetchError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .single();

    if (fetchError || !existingSong) {
      throw new NotFoundException('Song not found');
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('Title cannot be empty');
      }
      updateData.title = title;
    }

    const normalizedStationIds = Array.isArray(dto.stationIds)
      ? [
          ...new Set(
            dto.stationIds.map((id) => (id ?? '').trim()).filter(Boolean),
          ),
        ]
      : undefined;

    if (normalizedStationIds !== undefined) {
      if (normalizedStationIds.length === 0) {
        throw new BadRequestException(
          'stationIds must include at least one station',
        );
      }
      const invalid = normalizedStationIds.filter(
        (id) => !STATION_IDS.includes(id as (typeof STATION_IDS)[number]),
      );
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid stationIds: ${invalid.join(', ')}`,
        );
      }
      // Keep primary station for legacy paths; station_ids drives multi-station scope.
      updateData.station_id = normalizedStationIds[0];
      updateData.station_ids = normalizedStationIds;
    } else if (dto.stationId !== undefined) {
      if (
        !STATION_IDS.includes(dto.stationId as (typeof STATION_IDS)[number])
      ) {
        throw new BadRequestException('Invalid stationId');
      }
      updateData.station_id = dto.stationId;
      updateData.station_ids = [dto.stationId];
    }

    if (dto.artworkUrl !== undefined) {
      const artwork =
        typeof dto.artworkUrl === 'string' ? dto.artworkUrl.trim() : '';
      updateData.artwork_url = artwork.length > 0 ? artwork : null;
    }

    if (Object.keys(updateData).length === 1) {
      throw new BadRequestException('No editable fields provided');
    }

    const { data: updated, error: updateError } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select('id, title, station_id, station_ids, artwork_url')
      .single();

    if (updateError || !updated) {
      throw new BadRequestException(
        `Failed to update song metadata: ${updateError?.message || 'unknown error'}`,
      );
    }

    return {
      id: updated.id,
      title: updated.title,
      stationId: updated.station_id ?? null,
      stationIds:
        Array.isArray((updated as { station_ids?: unknown }).station_ids) &&
        ((updated as { station_ids?: unknown[] }).station_ids?.length ?? 0) > 0
          ? ((updated as { station_ids: string[] }).station_ids ?? [])
          : updated.station_id
            ? [updated.station_id]
            : [],
      artworkUrl: updated.artwork_url ?? null,
    };
  }

  /**
   * Trim a song's audio to a new start/end range and save as a new file in storage.
   * The song row is updated to point to the new trimmed file.
   */
  async trimSongAudio(
    songId: string,
    startSeconds: number,
    endSeconds: number,
  ) {
    const supabase = getSupabaseClient();

    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      throw new BadRequestException(
        'startSeconds and endSeconds must be numbers',
      );
    }
    if (startSeconds < 0 || endSeconds <= startSeconds) {
      throw new BadRequestException('Invalid trim range');
    }

    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('id, artist_id, title, audio_url, duration_seconds, status')
      .eq('id', songId)
      .single();

    if (fetchError || !song) {
      throw new NotFoundException('Song not found');
    }
    if (!song.audio_url) {
      throw new BadRequestException('Song has no audio source');
    }

    const originalDuration = Number(song.duration_seconds || 0);
    if (originalDuration > 0 && endSeconds > originalDuration) {
      throw new BadRequestException(
        `endSeconds cannot exceed song duration (${originalDuration}s)`,
      );
    }

    // Download source audio from existing URL.
    const sourceResponse = await fetch(song.audio_url);
    if (!sourceResponse.ok) {
      throw new BadRequestException(
        `Failed to fetch source audio: ${sourceResponse.status} ${sourceResponse.statusText}`,
      );
    }
    const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
    if (!sourceBuffer.length) {
      throw new BadRequestException('Source audio file is empty');
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = join(tmpdir(), `trim-input-${songId}-${runId}.bin`);
    const outputPath = join(tmpdir(), `trim-output-${songId}-${runId}.mp3`);
    const duration = endSeconds - startSeconds;
    try {
      if (!this.ffmpegConfigured) {
        throw new BadRequestException(
          'FFmpeg is not configured on the server. Set FFMPEG_PATH or install ffmpeg.',
        );
      }
      await fs.writeFile(inputPath, sourceBuffer);

      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .seekInput(startSeconds)
            .duration(duration)
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .format('mp3')
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(outputPath);
        });
      } catch (error) {
        throw new BadRequestException(
          `Failed to trim audio. Ensure ffmpeg is available on the server or set FFMPEG_PATH. ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const trimmedBuffer = await fs.readFile(outputPath);
      if (!trimmedBuffer.length) {
        throw new BadRequestException('Trimmed audio file is empty');
      }

      const storagePath = `${song.artist_id}/trimmed/${song.id}-${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('songs')
        .upload(storagePath, trimmedBuffer, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) {
        throw new BadRequestException(
          `Failed to upload trimmed file: ${uploadError.message}`,
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('songs')
        .getPublicUrl(storagePath);

      const newDurationSeconds = Math.ceil(duration);
      const { data: updatedSong, error: updateError } = await supabase
        .from('songs')
        .update({
          audio_url: publicUrlData.publicUrl,
          duration_seconds: newDurationSeconds,
          file_size_bytes: trimmedBuffer.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', songId)
        .select('*')
        .single();

      if (updateError) {
        throw new BadRequestException(
          `Failed to update song after trim: ${updateError.message}`,
        );
      }

      this.logger.log(
        `Trimmed song ${songId} (${startSeconds}-${endSeconds}s) and saved ${storagePath}`,
      );

      return {
        song: updatedSong,
        trim: {
          startSeconds,
          endSeconds,
          durationSeconds: newDurationSeconds,
          storagePath,
        },
      };
    } finally {
      // Best-effort cleanup of local temp files.
      await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
  }

  /**
   * Delete a song (admin). Removes DB record and storage files.
   */
  async deleteSong(songId: string) {
    const supabase = getSupabaseClient();

    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('id, audio_url, artwork_url')
      .eq('id', songId)
      .single();

    if (fetchError || !song) {
      throw new NotFoundException('Song not found');
    }

    if (song.audio_url) {
      await this.deleteFromStorage('songs', song.audio_url);
    }
    if (song.artwork_url) {
      await this.deleteFromStorage('artwork', song.artwork_url);
    }

    // Best-effort cleanup for environments where FK cascades may be missing.
    // Keep this resilient to missing tables/columns across different deployments.
    await this.safeDeleteBySongId('likes', songId);
    await this.safeDeleteBySongId('plays', songId);
    await this.safeDeleteBySongId('leaderboard_likes', songId);
    await this.safeDeleteBySongId('song_profile_listens', songId);
    await this.safeDeleteBySongId('prospector_sessions', songId);
    await this.safeDeleteBySongId('prospector_refinements', songId);
    await this.safeDeleteBySongId('prospector_surveys', songId);
    await this.safeDeleteBySongId('radio_listener_presence', songId);
    await this.safeDeleteBySongId('weekly_votes', songId);
    await this.safeDeleteBySongId('spotlight_listens', songId);
    await this.safeDeleteBySongId('daily_diamonds', songId);
    await this.safeDeleteBySongId('song_catalyst_credits', songId);
    await this.safeDeleteBySongId('credit_allocations', songId);
    await this.safeDeleteBySongId('discover_swipes', songId);
    await this.safeDeleteBySongId('discover_song_likes', songId);
    await this.safeDeleteBySongId('refinery_comments', songId);

    // Some tables store prefixed stack song IDs as text.
    await this.safeDeleteBySongVariants('rotation_queue', 'song_id', songId);

    // For SET NULL style relations, null out references where present.
    await this.safeNullSongId('chat_messages', songId);
    await this.safeNullSongId('play_decision_log', songId);
    await this.safeNullSongId('station_events', songId);
    await this.safeNullSongId('transactions', songId);
    await this.safeNullSongId('artist_spotlight', songId);
    await this.safeNullSongId('weekly_winners', songId);

    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId);

    if (deleteError) {
      throw new BadRequestException(
        `Failed to delete song: ${deleteError.message}`,
      );
    }

    this.logger.log(`Deleted song ${songId}`);
  }

  async getSwipeCards(filters?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();
    const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 500);
    const offset = Math.max(filters?.offset ?? 0, 0);
    const search = (filters?.search ?? '').trim();

    let query = supabase
      .from('songs')
      .select(
        'id, title, artist_id, artist_name, status, discover_enabled, discover_clip_url, discover_background_url, discover_clip_start_seconds, discover_clip_end_seconds, discover_clip_duration_seconds, created_at, updated_at',
        { count: 'exact' },
      )
      .not('discover_clip_url', 'is', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,artist_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new BadRequestException(
        `Failed to load discover swipe cards: ${error.message}`,
      );
    }

    const rows = (data || []) as Array<{
      id: string;
      title: string;
      artist_id: string;
      artist_name: string;
      status: string | null;
      discover_enabled: boolean | null;
      discover_clip_url: string | null;
      discover_background_url: string | null;
      discover_clip_start_seconds: number | null;
      discover_clip_end_seconds: number | null;
      discover_clip_duration_seconds: number | null;
      created_at: string | null;
      updated_at: string | null;
    }>;
    const artistIds = [...new Set(rows.map((row) => row.artist_id))];
    let users: Array<{ id: string; display_name: string | null }> = [];
    if (artistIds.length) {
      const { data: fetchedUsers } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', artistIds);
      users = (fetchedUsers || []) as Array<{
        id: string;
        display_name: string | null;
      }>;
    }
    const artistNameById = new Map(users.map((u) => [u.id, u.display_name]));

    return {
      items: rows.map((row) => ({
        songId: row.id,
        title: row.title,
        artistId: row.artist_id,
        artistName: row.artist_name,
        artistDisplayName: artistNameById.get(row.artist_id) ?? null,
        status: row.status ?? null,
        discoverEnabled: row.discover_enabled === true,
        clipUrl: row.discover_clip_url,
        backgroundUrl: row.discover_background_url,
        clipStartSeconds: row.discover_clip_start_seconds,
        clipEndSeconds: row.discover_clip_end_seconds,
        clipDurationSeconds: row.discover_clip_duration_seconds,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      total: count ?? rows.length,
    };
  }

  async deleteSwipeClip(songId: string) {
    const supabase = getSupabaseClient();
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select(
        'id, audio_url, discover_clip_url, discover_enabled, discover_background_url, discover_clip_start_seconds, discover_clip_end_seconds, discover_clip_duration_seconds',
      )
      .eq('id', songId)
      .single();

    if (songError || !song) {
      throw new NotFoundException('Song not found');
    }

    const clipUrl = (song as { discover_clip_url?: string | null })
      .discover_clip_url;
    if (!clipUrl) {
      throw new BadRequestException('Song has no discover clip to delete');
    }

    const sourceAudioUrl = (song as { audio_url?: string | null }).audio_url;
    if (clipUrl && (!sourceAudioUrl || clipUrl !== sourceAudioUrl)) {
      await this.deleteFromStorage('songs', clipUrl);
    }

    const updatePayload: Record<string, unknown> = {
      discover_enabled: false,
      discover_clip_url: null,
      discover_background_url: null,
      discover_clip_start_seconds: null,
      discover_clip_end_seconds: null,
      discover_clip_duration_seconds: null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('songs')
      .update(updatePayload)
      .eq('id', songId);

    if (updateError) {
      throw new BadRequestException(
        `Failed to delete discover clip: ${updateError.message}`,
      );
    }

    this.logger.log(`Deleted discover clip for song ${songId}`);
    return { deleted: true };
  }

  private isMissingRelationError(error: unknown): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const msg = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42P01') return true;
    if (maybe?.code === '42703') return true;
    if (maybe?.code === 'PGRST204') return true;
    return msg.includes('does not exist') || msg.includes('schema cache');
  }

  private async safeDeleteBySongId(
    table: string,
    songId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(table).delete().eq('song_id', songId);
    if (error && !this.isMissingRelationError(error)) {
      this.logger.warn(`Cleanup delete failed for ${table}: ${error.message}`);
    }
  }

  private async safeDeleteBySongVariants(
    table: string,
    column: string,
    songId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const variants = [songId, `song:${songId}`, `admin:${songId}`];
    const { error } = await supabase.from(table).delete().in(column, variants);
    if (error && !this.isMissingRelationError(error)) {
      this.logger.warn(`Cleanup delete failed for ${table}: ${error.message}`);
    }
  }

  private async safeNullSongId(table: string, songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(table)
      .update({ song_id: null })
      .eq('song_id', songId);
    if (error && !this.isMissingRelationError(error)) {
      this.logger.warn(`Cleanup nullify failed for ${table}: ${error.message}`);
    }
  }

  /**
   * Get a single user's profile by ID.
   */
  async getUserProfile(userId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select(
        'id, email, display_name, role, avatar_url, created_at, updated_at, is_banned, banned_at, ban_reason, is_shadow_banned',
      )
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('User not found');
    }

    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select(
        'id, title, artist_name, status, play_count, like_count, artwork_url, created_at',
      )
      .eq('artist_id', userId)
      .order('created_at', { ascending: false });

    if (songsError) {
      throw new BadRequestException(
        `Failed to load user songs: ${songsError.message}`,
      );
    }

    const songList = songs || [];
    const totalLikes = songList.reduce(
      (sum, song) => sum + (song.like_count || 0),
      0,
    );
    const totalPlays = songList.reduce(
      (sum, song) => sum + (song.play_count || 0),
      0,
    );

    return {
      user: data,
      songs: songList,
      totalLikes,
      totalPlays,
    };
  }

  // ========== Radios (stations) – used for fallback multi-select, state-scoped ==========

  /** Radios/stations (id, state, label). Match web/src/data/station-map.ts TOWERS for consistency. */
  getRadios(
    stateCode?: string,
  ): { id: string; state: string; label: string }[] {
    const radios = [
      { id: 'us-rap', state: 'US', label: 'Up & Coming Rap Radio (National)' },
      {
        id: 'us-ready-now-rap',
        state: 'US',
        label: 'Ready Now Rap Radio (National)',
      },
      { id: 'us-hip-hop', state: 'US', label: 'Hip Hop (National)' },
      { id: 'us-country', state: 'US', label: 'Country (National)' },
      { id: 'us-rock', state: 'US', label: 'Rock (National)' },
      { id: 'us-pop', state: 'US', label: 'Pop (National)' },
      { id: 'us-edm', state: 'US', label: 'EDM (National)' },
      { id: 'us-rnb', state: 'US', label: 'R&B (National)' },
      { id: 'us-podcasts', state: 'US', label: 'Podcasts (National)' },
      { id: 'us-spoken-word', state: 'US', label: 'Spoken Word (National)' },
      { id: 'us-comedian', state: 'US', label: 'Comedian (National)' },
      { id: 'us-gospel', state: 'US', label: 'Gospel (National)' },
      { id: 'us-classical', state: 'US', label: 'Classical Radio (National)' },
      { id: 'us-emo', state: 'US', label: 'Emo Radio (National)' },
      { id: 'default', state: 'US', label: 'Default' },
    ];
    if (stateCode?.trim()) {
      return radios.filter((r) => r.state === stateCode.trim());
    }
    return radios;
  }

  // ========== Fallback Playlist Management ==========

  /** All fallback rows grouped by (title, artist_name, audio_url); each group has radio_ids[]. */
  async getFallbackSongsGrouped(): Promise<
    {
      id: string;
      title: string;
      artist_name: string;
      audio_url: string;
      artwork_url: string | null;
      duration_seconds: number;
      is_active: boolean;
      created_at: string;
      radio_ids: string[];
    }[]
  > {
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from('admin_fallback_songs')
      .select(
        'id, title, artist_name, audio_url, artwork_url, duration_seconds, is_active, created_at, radio_id',
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch fallback songs: ${error.message}`,
      );
    }

    const key = (r: {
      title: string;
      artist_name: string;
      audio_url: string;
    }) => `${r.title}|${r.artist_name}|${r.audio_url}`;
    const groups = new Map<
      string,
      {
        id: string;
        title: string;
        artist_name: string;
        audio_url: string;
        artwork_url: string | null;
        duration_seconds: number;
        is_active: boolean;
        created_at: string;
        radio_ids: string[];
      }
    >();
    for (const r of rows || []) {
      const k = key(r);
      if (!groups.has(k)) {
        groups.set(k, {
          id: r.id,
          title: r.title,
          artist_name: r.artist_name,
          audio_url: r.audio_url,
          artwork_url: r.artwork_url ?? null,
          duration_seconds: r.duration_seconds ?? 180,
          is_active: r.is_active ?? true,
          created_at: r.created_at,
          radio_ids: [],
        });
      }
      const g = groups.get(k)!;
      if (!g.radio_ids.includes(r.radio_id)) {
        g.radio_ids.push(r.radio_id);
      }
    }
    return Array.from(groups.values());
  }

  /** Set which radios a fallback song (group) is on. Replaces all rows for that content with one row per radio. */
  async setFallbackSongRadios(representativeRowId: string, radioIds: string[]) {
    const supabase = getSupabaseClient();
    const { data: row, error: fetchError } = await supabase
      .from('admin_fallback_songs')
      .select(
        'id, title, artist_name, audio_url, artwork_url, duration_seconds, is_active',
      )
      .eq('id', representativeRowId)
      .single();

    if (fetchError || !row) {
      throw new NotFoundException('Fallback song not found');
    }

    const contentKey = `${row.title}|${row.artist_name}|${row.audio_url}`;
    const { data: existing } = await supabase
      .from('admin_fallback_songs')
      .select('id')
      .eq('title', row.title)
      .eq('artist_name', row.artist_name)
      .eq('audio_url', row.audio_url);

    const idsToDelete = (existing || []).map((r) => r.id);
    if (idsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from('admin_fallback_songs')
        .delete()
        .in('id', idsToDelete);
      if (delError) {
        throw new BadRequestException(
          `Failed to update radios: ${delError.message}`,
        );
      }
    }

    const distinctRadios = [...new Set(radioIds.filter((id) => id?.trim()))];
    if (distinctRadios.length === 0) {
      return { updated: true, radio_ids: [] };
    }

    const inserts = distinctRadios.map((radio_id) => ({
      radio_id,
      title: row.title,
      artist_name: row.artist_name,
      audio_url: row.audio_url,
      artwork_url: row.artwork_url ?? null,
      duration_seconds: row.duration_seconds ?? 180,
      is_active: row.is_active ?? true,
    }));
    const { error: insertError } = await supabase
      .from('admin_fallback_songs')
      .insert(inserts);
    if (insertError) {
      throw new BadRequestException(
        `Failed to set radios: ${insertError.message}`,
      );
    }
    return { updated: true, radio_ids: distinctRadios };
  }

  /** Update is_active for all rows that share the same content as the given row (all radios). */
  async updateFallbackSongGroup(
    representativeRowId: string,
    dto: { isActive?: boolean },
  ) {
    const supabase = getSupabaseClient();
    const { data: row, error: fetchError } = await supabase
      .from('admin_fallback_songs')
      .select('id, title, artist_name, audio_url')
      .eq('id', representativeRowId)
      .single();
    if (fetchError || !row) {
      throw new NotFoundException('Fallback song not found');
    }
    const updatePayload: { is_active?: boolean; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (dto.isActive !== undefined) updatePayload.is_active = dto.isActive;
    const { error: updateError } = await supabase
      .from('admin_fallback_songs')
      .update(updatePayload)
      .eq('title', row.title)
      .eq('artist_name', row.artist_name)
      .eq('audio_url', row.audio_url);
    if (updateError) {
      throw new BadRequestException(
        `Failed to update fallback song: ${updateError.message}`,
      );
    }
    return { updated: true };
  }

  /** Delete all rows that share the same content (remove song from all radios). */
  async deleteFallbackSongGroup(representativeRowId: string) {
    const supabase = getSupabaseClient();
    const { data: row, error: fetchError } = await supabase
      .from('admin_fallback_songs')
      .select('id, title, artist_name, audio_url')
      .eq('id', representativeRowId)
      .single();
    if (fetchError || !row) {
      throw new NotFoundException('Fallback song not found');
    }
    const { error: delError } = await supabase
      .from('admin_fallback_songs')
      .delete()
      .eq('title', row.title)
      .eq('artist_name', row.artist_name)
      .eq('audio_url', row.audio_url);
    if (delError) {
      throw new BadRequestException(
        `Failed to delete fallback song: ${delError.message}`,
      );
    }
    return { deleted: true };
  }

  async getFallbackSongs(radioId: string = 'default') {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .eq('radio_id', radioId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch fallback songs: ${error.message}`,
      );
    }

    return data;
  }

  async addFallbackSong(
    dto: {
      title: string;
      artistName: string;
      audioUrl: string;
      artworkUrl?: string;
      durationSeconds?: number;
    },
    radioId: string = 'default',
  ) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .insert({
        radio_id: radioId,
        title: dto.title,
        artist_name: dto.artistName,
        audio_url: dto.audioUrl,
        artwork_url: dto.artworkUrl,
        duration_seconds: dto.durationSeconds || 180,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to add fallback song: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Add a fallback song from uploaded file paths (storage paths → public URLs).
   */
  async addFallbackSongFromUpload(
    adminId: string,
    dto: {
      title: string;
      artistName: string;
      audioPath: string;
      artworkPath?: string;
      durationSeconds?: number;
    },
    radioId: string = 'default',
  ) {
    const supabase = getSupabaseClient();

    const { data: audioUrlData } = supabase.storage
      .from('songs')
      .getPublicUrl(dto.audioPath);
    const audioUrl = audioUrlData.publicUrl;

    let artworkUrl: string | undefined;
    if (dto.artworkPath) {
      const { data: artworkUrlData } = supabase.storage
        .from('artwork')
        .getPublicUrl(dto.artworkPath);
      artworkUrl = artworkUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .insert({
        radio_id: radioId,
        title: dto.title,
        artist_name: dto.artistName,
        audio_url: audioUrl,
        artwork_url: artworkUrl,
        duration_seconds: dto.durationSeconds ?? 180,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to add fallback song from upload: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Add a fallback song by copying an existing approved song.
   */
  async addFallbackSongFromSong(songId: string, radioId: string = 'default') {
    const supabase = getSupabaseClient();

    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select(
        'id, title, audio_url, artwork_url, duration_seconds, artist_id, users:artist_id(display_name)',
      )
      .eq('id', songId)
      .eq('status', 'approved')
      .single();

    if (fetchError || !song) {
      throw new NotFoundException('Song not found or not approved');
    }

    const artistName = (song.users as any)?.display_name ?? 'Unknown Artist';

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .insert({
        radio_id: radioId,
        title: song.title,
        artist_name: artistName,
        audio_url: song.audio_url,
        artwork_url: song.artwork_url ?? undefined,
        duration_seconds: song.duration_seconds ?? 180,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to add fallback song from song: ${error.message}`,
      );
    }

    return data;
  }

  async updateFallbackSong(
    songId: string,
    dto: { isActive?: boolean },
    radioId: string = 'default',
  ) {
    const supabase = getSupabaseClient();

    const updateData: any = { updated_at: new Date().toISOString() };
    if (dto.isActive !== undefined) {
      updateData.is_active = dto.isActive;
    }

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .update(updateData)
      .eq('id', songId)
      .eq('radio_id', radioId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update fallback song: ${error.message}`,
      );
    }

    return data;
  }

  async deleteFallbackSong(songId: string, radioId: string = 'default') {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('admin_fallback_songs')
      .delete()
      .eq('id', songId)
      .eq('radio_id', radioId);

    if (error) {
      throw new BadRequestException(
        `Failed to delete fallback song: ${error.message}`,
      );
    }

    return { deleted: true };
  }

  async getAnalytics() {
    const supabase = getSupabaseClient();

    // Get user counts by role
    const { data: userCounts, error: userError } = await supabase
      .from('users')
      .select('role');

    if (userError) {
      throw new BadRequestException(
        `Failed to fetch user analytics: ${userError.message}`,
      );
    }

    const totalUsers = userCounts?.length || 0;
    const totalArtists =
      userCounts?.filter((u) => u.role === 'artist').length || 0;
    const totalListeners =
      userCounts?.filter((u) => u.role === 'listener').length || 0;

    // Get song counts by status
    const { data: songCounts, error: songError } = await supabase
      .from('songs')
      .select('status');

    if (songError) {
      throw new BadRequestException(
        `Failed to fetch song analytics: ${songError.message}`,
      );
    }

    const totalSongs = songCounts?.length || 0;
    const pendingSongs =
      songCounts?.filter((s) => s.status === 'pending').length || 0;
    const approvedSongs =
      songCounts?.filter((s) => s.status === 'approved').length || 0;

    // Get total plays
    const { count: totalPlays, error: playsError } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true });

    if (playsError) {
      throw new BadRequestException(
        `Failed to fetch play analytics: ${playsError.message}`,
      );
    }

    // Get total likes
    const { count: totalLikes, error: likesError } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true });

    if (likesError) {
      throw new BadRequestException(
        `Failed to fetch likes analytics: ${likesError.message}`,
      );
    }

    return {
      totalUsers,
      totalArtists,
      totalListeners,
      totalSongs,
      pendingSongs,
      approvedSongs,
      totalPlays: totalPlays || 0,
      totalLikes: totalLikes || 0,
    };
  }

  async getAllUsers(filters: {
    role?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('users')
      .select('id, email, display_name, role, avatar_url, created_at');

    if (filters.role && filters.role !== 'all') {
      query = query.eq('role', filters.role);
    }

    // Search by display name or email
    if (filters.search && filters.search.trim()) {
      query = query.or(
        `display_name.ilike.%${filters.search.trim()}%,email.ilike.%${filters.search.trim()}%`,
      );
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    const ascending = sortOrder === 'asc';

    // Map frontend sort keys to database columns
    const sortColumnMap: Record<string, string> = {
      name: 'display_name',
      email: 'email',
      role: 'role',
      created_at: 'created_at',
    };
    const sortColumn = sortColumnMap[sortBy] || 'created_at';

    query = query.order(sortColumn, { ascending });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 50) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(`Failed to fetch users: ${error.message}`);
    }

    return data;
  }

  async updateUserRole(userId: string, role: 'listener' | 'artist' | 'admin') {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update user role: ${error.message}`,
      );
    }

    return data;
  }

  // ========== User Ban Management ==========

  /**
   * Hard ban a user: revoke Firebase tokens, set ban flag, optionally delete data.
   * Use for ToS violators - fully locks them out.
   */
  async hardBanUser(
    userId: string,
    adminId: string,
    reason: string,
    deleteUserData: boolean = false,
  ): Promise<BanResult> {
    const supabase = getSupabaseClient();

    // 1. Get the user's Firebase UID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, firebase_uid, email, display_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // 2. Set ban flags in database
    const { error: banError } = await supabase
      .from('users')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason,
        banned_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (banError) {
      throw new BadRequestException(`Failed to ban user: ${banError.message}`);
    }

    // 3. Revoke all Firebase refresh tokens (forces logout everywhere)
    let tokenRevoked = false;
    if (user.firebase_uid) {
      try {
        const auth = getFirebaseAuth();
        await auth.revokeRefreshTokens(user.firebase_uid);
        tokenRevoked = true;
        this.logger.log(
          `Revoked refresh tokens for user ${userId} (Firebase: ${user.firebase_uid})`,
        );
      } catch (firebaseError) {
        this.logger.error(
          `Failed to revoke Firebase tokens: ${firebaseError.message}`,
        );
      }
    }

    // 4. Delete FCM push tokens (stop notifications)
    await supabase.from('push_tokens').delete().eq('user_id', userId);

    // 5. Optionally delete user data (songs, likes, etc.) while preserving credentials
    if (deleteUserData) {
      // Delete user's songs
      await supabase.from('songs').delete().eq('artist_id', userId);
      // Delete user's likes
      await supabase.from('likes').delete().eq('user_id', userId);
      // Delete user's notifications
      await supabase.from('notifications').delete().eq('user_id', userId);
      // Delete user's chat messages (soft delete - mark as deleted)
      await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId);

      this.logger.log(`Deleted data for banned user ${userId}`);
    }

    this.logger.log(`Hard banned user ${userId}. Reason: ${reason}`);

    return {
      success: true,
      userId,
      banType: 'hard',
      tokenRevoked,
    };
  }

  /**
   * Shadow ban a user: user thinks they're active but no one sees their messages.
   * Use for chat trolls - reduces Alt Account creation.
   */
  async shadowBanUser(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<BanResult> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('users')
      .update({
        is_shadow_banned: true,
        shadow_banned_at: new Date().toISOString(),
        shadow_ban_reason: reason,
        shadow_banned_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException(
        `Failed to shadow ban user: ${error.message}`,
      );
    }

    this.logger.log(`Shadow banned user ${userId}. Reason: ${reason}`);

    return {
      success: true,
      userId,
      banType: 'shadow',
      tokenRevoked: false,
    };
  }

  /**
   * Restore a banned user's access.
   */
  async restoreUser(
    userId: string,
  ): Promise<{ success: boolean; userId: string }> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('users')
      .update({
        is_banned: false,
        banned_at: null,
        ban_reason: null,
        banned_by: null,
        is_shadow_banned: false,
        shadow_banned_at: null,
        shadow_ban_reason: null,
        shadow_banned_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw new BadRequestException(`Failed to restore user: ${error.message}`);
    }

    this.logger.log(`Restored user ${userId}`);

    return { success: true, userId };
  }

  /**
   * Delete a user account: remove all user data and Firebase user.
   * User can sign up again after deletion.
   */
  async deleteUserAccount(userId: string) {
    const supabase = getSupabaseClient();
    const auth = getFirebaseAuth();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, firebase_uid')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // Delete user's songs (and storage)
    const { data: songs } = await supabase
      .from('songs')
      .select('id, audio_url, artwork_url')
      .eq('artist_id', userId);
    if (songs?.length) {
      for (const song of songs) {
        if (song.audio_url)
          await this.deleteFromStorage('songs', song.audio_url);
        if (song.artwork_url)
          await this.deleteFromStorage('artwork', song.artwork_url);
      }
    }
    await supabase.from('songs').delete().eq('artist_id', userId);

    await supabase.from('likes').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('push_tokens').delete().eq('user_id', userId);
    await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (user.firebase_uid) {
      try {
        await auth.deleteUser(user.firebase_uid);
        this.logger.log(
          `Deleted Firebase user ${user.firebase_uid} for account ${userId}`,
        );
      } catch (firebaseError) {
        this.logger.warn(
          `Firebase deleteUser failed: ${firebaseError.message}`,
        );
      }
    }

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (deleteError) {
      throw new BadRequestException(
        `Failed to delete user: ${deleteError.message}`,
      );
    }

    this.logger.log(`Deleted user account ${userId}`);
  }

  /**
   * Lifetime ban: delete all artist songs and storage, revoke tokens, keep user record so they cannot re-register.
   */
  async lifetimeBanUser(
    userId: string,
    adminId: string,
    reason: string,
  ): Promise<BanResult> {
    const supabase = getSupabaseClient();
    const auth = getFirebaseAuth();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, firebase_uid')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // Delete all artist songs and storage
    const { data: songs } = await supabase
      .from('songs')
      .select('id, audio_url, artwork_url')
      .eq('artist_id', userId);
    if (songs?.length) {
      for (const song of songs) {
        if (song.audio_url)
          await this.deleteFromStorage('songs', song.audio_url);
        if (song.artwork_url)
          await this.deleteFromStorage('artwork', song.artwork_url);
      }
    }
    await supabase.from('songs').delete().eq('artist_id', userId);

    await supabase.from('likes').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('push_tokens').delete().eq('user_id', userId);

    const { error: banError } = await supabase
      .from('users')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason,
        banned_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (banError) {
      throw new BadRequestException(
        `Failed to lifetime ban user: ${banError.message}`,
      );
    }

    let tokenRevoked = false;
    if (user.firebase_uid) {
      try {
        await auth.revokeRefreshTokens(user.firebase_uid);
        tokenRevoked = true;
      } catch (firebaseError) {
        this.logger.warn(`Failed to revoke tokens: ${firebaseError.message}`);
      }
    }

    this.logger.log(`Lifetime banned user ${userId}. Reason: ${reason}`);
    return {
      success: true,
      userId,
      banType: 'hard',
      tokenRevoked,
    };
  }

  /**
   * Extract storage path from public URL and delete the file.
   * URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
   */
  private async deleteFromStorage(bucket: string, url: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(
        /\/storage\/v1\/object\/public\/[^/]+\/(.+)/,
      );
      if (!pathMatch) {
        this.logger.warn(`Could not extract path from URL: ${url}`);
        return;
      }
      const filePath = pathMatch[1];
      const { error } = await supabase.storage.from(bucket).remove([filePath]);
      if (error)
        this.logger.warn(`Failed to delete from ${bucket}: ${error.message}`);
    } catch {
      this.logger.warn(`Could not parse storage URL: ${url}`);
    }
  }

  /**
   * Get all banned users (both hard and shadow banned).
   */
  async getBannedUsers(): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select(
        'id, email, display_name, is_banned, banned_at, ban_reason, is_shadow_banned, shadow_banned_at, shadow_ban_reason',
      )
      .or('is_banned.eq.true,is_shadow_banned.eq.true')
      .order('banned_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch banned users: ${error.message}`,
      );
    }

    return data || [];
  }

  // =============================================
  // FREE ROTATION SEARCH (Item 5)
  // =============================================

  /**
   * Search songs by title for free rotation management.
   * Returns songs with eligibility status for free rotation.
   */
  async searchSongsForFreeRotation(query: string, limit = 20): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('songs')
      .select(
        `
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        credits_remaining, play_count, like_count,
        artist_id, created_at,
        users!songs_artist_id_fkey(id, display_name, email)
      `,
      )
      .ilike('title', `%${query}%`)
      .eq('status', 'approved')
      .order('title', { ascending: true })
      .limit(limit);

    if (error) {
      throw new BadRequestException(`Failed to search songs: ${error.message}`);
    }

    // Add eligibility status to each song.
    // Free rotation is admin-controlled only (no artist opt-in requirement).
    return (data || []).map((song) => ({
      ...song,
      isEligibleForFreeRotation: song.admin_free_rotation === true,
      eligibilityChecks: {
        hasPaidPlay: true, // currently not required
        artistOptedIn: true, // no longer required
        adminApproved: song.admin_free_rotation === true,
      },
    }));
  }

  /**
   * Search users by name or email.
   */
  async searchUsersForFreeRotation(query: string, limit = 20): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, email, role, created_at')
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('display_name', { ascending: true })
      .limit(limit);

    if (error) {
      throw new BadRequestException(`Failed to search users: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get songs by a specific user for free rotation management.
   */
  async getUserSongsForFreeRotation(userId: string): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('songs')
      .select(
        `
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        credits_remaining, play_count, like_count,
        created_at
      `,
      )
      .eq('artist_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch user songs: ${error.message}`,
      );
    }

    // Add eligibility status to each song.
    // Free rotation is admin-controlled only (no artist opt-in requirement).
    return (data || []).map((song) => ({
      ...song,
      isEligibleForFreeRotation: song.admin_free_rotation === true,
      eligibilityChecks: {
        hasPaidPlay: true, // currently not required
        artistOptedIn: true, // no longer required
        adminApproved: song.admin_free_rotation === true,
      },
    }));
  }

  /**
   * Toggle free rotation status for a song (admin side).
   */
  async toggleFreeRotation(songId: string, enabled: boolean): Promise<any> {
    const supabase = getSupabaseClient();

    // If enabling, verify song exists.
    if (enabled) {
      const { data: song, error: fetchError } = await supabase
        .from('songs')
        .select('title')
        .eq('id', songId)
        .single();

      if (fetchError || !song) {
        throw new BadRequestException('Song not found');
      }
    }

    const { data, error } = await supabase
      .from('songs')
      .update({ admin_free_rotation: enabled })
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to toggle free rotation: ${error.message}`,
      );
    }

    this.logger.log(
      `Free rotation ${enabled ? 'enabled' : 'disabled'} for song ${songId}`,
    );
    return data;
  }

  /**
   * Get all songs currently in free rotation.
   */
  async getSongsInFreeRotation(radioId?: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    const stationId = normalizeSongStationId(radioId);

    const { data, error } = await supabase
      .from('songs')
      .select(
        `
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        play_count, like_count, last_played_at,
        artist_id, created_at,
        users!songs_artist_id_fkey(id, display_name, email)
      `,
      )
      .eq('status', 'approved')
      .or(`station_id.eq.${stationId},station_ids.cs.{${stationId}}`)
      .eq('admin_free_rotation', true)
      .order('last_played_at', { ascending: true, nullsFirst: true });

    if (error) {
      throw new BadRequestException(
        `Failed to fetch free rotation songs: ${error.message}`,
      );
    }

    return data || [];
  }

  // ========== Live Broadcast ==========

  async startLiveBroadcast(
    adminUserId: string,
  ): Promise<{ id: string; startedAt: string }> {
    const supabase = getSupabaseClient();
    const { data: existing } = await supabase
      .from('live_broadcast')
      .select('id')
      .eq('status', 'active')
      .maybeSingle();
    if (existing) {
      throw new BadRequestException(
        'A live broadcast is already active. Stop it first.',
      );
    }
    const { data, error } = await supabase
      .from('live_broadcast')
      .insert({
        status: 'active',
        started_by_user_id: adminUserId,
      })
      .select('id, started_at')
      .single();
    if (error)
      throw new BadRequestException(
        `Failed to start live broadcast: ${error.message}`,
      );
    this.logger.log(`Live broadcast started by admin ${adminUserId}`);
    return { id: data.id, startedAt: data.started_at };
  }

  async stopLiveBroadcast(): Promise<{ endedAt: string }> {
    const supabase = getSupabaseClient();
    const { data: row } = await supabase
      .from('live_broadcast')
      .select('id')
      .eq('status', 'active')
      .maybeSingle();
    if (!row) {
      throw new BadRequestException('No active live broadcast to stop.');
    }
    const endedAt = new Date().toISOString();
    const { error } = await supabase
      .from('live_broadcast')
      .update({ status: 'ended', ended_at: endedAt })
      .eq('id', row.id);
    if (error)
      throw new BadRequestException(
        `Failed to stop live broadcast: ${error.message}`,
      );
    this.logger.log('Live broadcast ended');
    return { endedAt };
  }

  async getLiveBroadcastStatus(): Promise<{
    active: boolean;
    startedAt?: string;
  }> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('live_broadcast')
      .select('started_at')
      .eq('status', 'active')
      .maybeSingle();
    return data
      ? { active: true, startedAt: data.started_at }
      : { active: false };
  }

  // ========== Browse Feed Management ==========

  async getFeedMedia(reportedOnly?: boolean): Promise<{
    items: Array<{
      id: string;
      type: string;
      fileUrl: string;
      title: string | null;
      description: string | null;
      createdAt: string;
      optInFeed: boolean;
      feedRemovedAt: string | null;
      provider: { userId: string; displayName: string | null };
      likeCount: number;
      reportCount: number;
      reports: Array<{ reason: string; createdAt: string; userId: string }>;
    }>;
  }> {
    const supabase = getSupabaseClient();
    const query = supabase
      .from('provider_portfolio_items')
      .select(
        `
        id,
        user_id,
        type,
        file_url,
        title,
        description,
        created_at,
        opt_in_feed,
        feed_removed_at,
        users (
          id,
          display_name
        )
      `,
      )
      .eq('opt_in_feed', true);

    const { data: rows, error } = await query.order('created_at', {
      ascending: false,
    });
    if (error) throw new Error(`Failed to fetch feed media: ${error.message}`);
    const items = (rows || []) as any[];

    if (items.length === 0) {
      return { items: [] };
    }

    const contentIds = items.map((r) => r.id);
    const { data: likeRows } = await supabase
      .from('browse_likes')
      .select('content_id')
      .in('content_id', contentIds);
    const likeCounts = new Map<string, number>();
    for (const row of likeRows || []) {
      likeCounts.set(row.content_id, (likeCounts.get(row.content_id) ?? 0) + 1);
    }

    const { data: reportRows } = await supabase
      .from('browse_reports')
      .select('content_id, reason, created_at, user_id')
      .in('content_id', contentIds)
      .order('created_at', { ascending: false });
    const reportsByContent = new Map<
      string,
      Array<{ reason: string; createdAt: string; userId: string }>
    >();
    for (const r of reportRows || []) {
      const list = reportsByContent.get(r.content_id) ?? [];
      list.push({
        reason: r.reason,
        createdAt: r.created_at,
        userId: r.user_id,
      });
      reportsByContent.set(r.content_id, list);
    }

    let result = items.map((row) => {
      const u = row.users;
      const reports = reportsByContent.get(row.id) ?? [];
      return {
        id: row.id,
        type: row.type,
        fileUrl: row.file_url,
        title: row.title ?? null,
        description: row.description ?? null,
        createdAt: row.created_at,
        optInFeed: row.opt_in_feed ?? true,
        feedRemovedAt: row.feed_removed_at ?? null,
        provider: { userId: row.user_id, displayName: u?.display_name ?? null },
        likeCount: likeCounts.get(row.id) ?? 0,
        reportCount: reports.length,
        reports,
      };
    });

    result = result.sort((a, b) => b.likeCount - a.likeCount);
    if (reportedOnly) {
      result = result.filter((r) => r.reportCount > 0);
    }
    return { items: result };
  }

  async removeFromFeed(contentId: string, adminId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: item } = await supabase
      .from('provider_portfolio_items')
      .select('id')
      .eq('id', contentId)
      .single();
    if (!item) throw new NotFoundException('Content not found');
    const { error } = await supabase
      .from('provider_portfolio_items')
      .update({
        feed_removed_at: new Date().toISOString(),
        feed_removed_by: adminId,
      })
      .eq('id', contentId);
    if (error) throw new Error(`Failed to remove from feed: ${error.message}`);
  }

  private async safeDeleteByContentId(
    table: string,
    contentId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('content_id', contentId);
    if (error && !this.isMissingRelationError(error)) {
      this.logger.warn(`Cleanup delete failed for ${table}: ${error.message}`);
    }
  }

  async deleteFeedMedia(contentId: string, adminId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: item } = await supabase
      .from('provider_portfolio_items')
      .select('id, file_url')
      .eq('id', contentId)
      .single();
    if (!item) throw new NotFoundException('Content not found');

    // Best-effort cleanup for related browse interactions.
    await this.safeDeleteByContentId('browse_likes', contentId);
    await this.safeDeleteByContentId('browse_bookmarks', contentId);
    await this.safeDeleteByContentId('browse_reports', contentId);

    // Best-effort storage cleanup for portfolio media file.
    if ((item as { file_url?: string | null }).file_url) {
      await this.deleteFromStorage(
        'portfolio',
        (item as { file_url: string }).file_url,
      );
    }

    const { error } = await supabase
      .from('provider_portfolio_items')
      .delete()
      .eq('id', contentId);
    if (error)
      throw new Error(`Failed to delete social card: ${error.message}`);

    this.logger.log(`Deleted social card ${contentId} by admin ${adminId}`);
  }

  async listStreamerApplications(): Promise<
    Array<{
      userId: string;
      displayName: string | null;
      email: string | null;
      role: string | null;
      appliedAt: string;
    }>
  > {
    const supabase = getSupabaseClient();
    const { data: profiles, error } = await supabase
      .from('artist_live_profiles')
      .select('user_id, streaming_applied_at')
      .not('streaming_applied_at', 'is', null)
      .is('streaming_approved_at', null)
      .is('streaming_rejected_at', null)
      .order('streaming_applied_at', { ascending: false });
    if (error || !profiles?.length) return [];
    const userIds = profiles.map((p: { user_id: string }) => p.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, email, role')
      .in('id', userIds);
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    return profiles.map(
      (p: { user_id: string; streaming_applied_at: string }) => {
        const u = userMap.get(p.user_id);
        return {
          userId: p.user_id,
          displayName: u?.display_name ?? null,
          email: u?.email ?? null,
          role: u?.role ?? null,
          appliedAt: p.streaming_applied_at,
        };
      },
    );
  }

  async setStreamerApproval(
    userId: string,
    action: 'approve' | 'reject',
  ): Promise<{ approved: boolean; approvedAt?: string; rejectedAt?: string }> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> =
      action === 'approve'
        ? { streaming_approved_at: now, streaming_rejected_at: null }
        : { streaming_rejected_at: now };
    const { error } = await supabase
      .from('artist_live_profiles')
      .update(updates)
      .eq('user_id', userId);
    if (error)
      throw new BadRequestException(`Failed to ${action}: ${error.message}`);
    return action === 'approve'
      ? { approved: true, approvedAt: now }
      : { approved: false, rejectedAt: now };
  }
}
