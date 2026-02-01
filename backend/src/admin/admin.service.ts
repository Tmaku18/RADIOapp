import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { getFirebaseAuth } from '../config/firebase.config';
import { EmailService } from '../email/email.service';

export interface BanResult {
  success: boolean;
  userId: string;
  banType: 'hard' | 'shadow';
  tokenRevoked: boolean;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly emailService: EmailService) {}
  async getSongsPendingApproval(filters: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('songs')
      .select(`
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
      artist: 'artist_name',
      artist_name: 'artist_name',
      created_at: 'created_at',
      status: 'status',
    };
    const sortColumn = sortColumnMap[sortBy] || 'created_at';
    
    query = query.order(sortColumn, { ascending });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
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
      .select('id, status, title, artist_id, users:artist_id(id, email, display_name)')
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
    } else if (status === 'pending') {
      // Clear rejection fields when reverting to pending
      updateData.rejection_reason = null;
      updateData.rejected_at = null;
    }

    // Update the song status
    const { data, error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update song status: ${error.message}`);
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

      this.logger.log(`Song ${songId} status changed: ${previousStatus} -> ${status}`);

      // Send email notification for approve/reject
      const artistEmail = (existingSong.users as any)?.email;
      if (artistEmail) {
        if (status === 'approved') {
          await this.emailService.sendSongApprovedEmail(artistEmail, existingSong.title);
        } else if (status === 'rejected') {
          await this.emailService.sendSongRejectedEmail(artistEmail, existingSong.title, reason);
        }
      }
    }

    return data;
  }

  /**
   * Delete a song from the database and storage. Removes audio/artwork files
   * and any admin_fallback_songs entry. Database cascades handle plays, likes, etc.
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

    // Delete audio from storage
    if (song.audio_url) {
      const audioPath = this.extractStoragePathFromUrl(song.audio_url, 'songs');
      if (audioPath) {
        await supabase.storage.from('songs').remove([audioPath]);
      }
    }
    // Delete artwork from storage
    if (song.artwork_url) {
      const artworkPath = this.extractStoragePathFromUrl(song.artwork_url, 'artwork');
      if (artworkPath) {
        await supabase.storage.from('artwork').remove([artworkPath]);
      }
    }

    // Remove from admin_fallback_songs if present
    await supabase.from('admin_fallback_songs').delete().eq('audio_url', song.audio_url);

    // Delete song (cascades: plays, rotation_queue, play_decision_log, credit_allocations, likes)
    const { error: deleteError } = await supabase.from('songs').delete().eq('id', songId);

    if (deleteError) {
      throw new BadRequestException(`Failed to delete song: ${deleteError.message}`);
    }

    this.logger.log(`Admin deleted song ${songId}`);
  }

  // ========== Fallback Playlist Management ==========

  async getFallbackSongs() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch fallback songs: ${error.message}`);
    }

    return data;
  }

  async addFallbackSong(dto: {
    title: string;
    artistName: string;
    audioUrl: string;
    artworkUrl?: string;
    durationSeconds?: number;
  }) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .insert({
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
      throw new BadRequestException(`Failed to add fallback song: ${error.message}`);
    }

    return data;
  }

  async updateFallbackSong(songId: string, dto: { isActive?: boolean }) {
    const supabase = getSupabaseClient();

    const updateData: any = { updated_at: new Date().toISOString() };
    if (dto.isActive !== undefined) {
      updateData.is_active = dto.isActive;
    }

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update fallback song: ${error.message}`);
    }

    return data;
  }

  async deleteFallbackSong(songId: string) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('admin_fallback_songs')
      .delete()
      .eq('id', songId);

    if (error) {
      throw new BadRequestException(`Failed to delete fallback song: ${error.message}`);
    }

    return { deleted: true };
  }

  /**
   * Add a song from admin upload to the songs table (free rotation database).
   * Song is created with status='pending' and admin_free_rotation=false.
   * Admin must approve and enable for free rotation via Admin Songs page.
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
      .from('songs')
      .insert({
        artist_id: adminId,
        title: dto.title,
        artist_name: dto.artistName,
        audio_url: audioUrl,
        artwork_url: artworkUrl,
        duration_seconds: dto.durationSeconds || 180,
        status: 'pending',
        admin_free_rotation: false,
        opt_in_free_play: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to add song from upload: ${error.message}`);
    }

    return data;
  }

  async addFallbackSongFromSong(songId: string) {
    const supabase = getSupabaseClient();

    const { data: song, error: fetchError } = await supabase
      .from('songs')
      .select('title, artist_name, audio_url, artwork_url, duration_seconds')
      .eq('id', songId)
      .single();

    if (fetchError || !song) {
      throw new BadRequestException('Song not found');
    }

    const { data, error } = await supabase
      .from('admin_fallback_songs')
      .insert({
        title: song.title,
        artist_name: song.artist_name,
        audio_url: song.audio_url,
        artwork_url: song.artwork_url ?? null,
        duration_seconds: song.duration_seconds || 180,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to add fallback song from song: ${error.message}`);
    }

    return data;
  }

  async getAnalytics() {
    const supabase = getSupabaseClient();

    // Get user counts by role
    const { data: userCounts, error: userError } = await supabase
      .from('users')
      .select('role');

    if (userError) {
      throw new BadRequestException(`Failed to fetch user analytics: ${userError.message}`);
    }

    const totalUsers = userCounts?.length || 0;
    const totalArtists = userCounts?.filter(u => u.role === 'artist').length || 0;
    const totalListeners = userCounts?.filter(u => u.role === 'listener').length || 0;

    // Get song counts by status
    const { data: songCounts, error: songError } = await supabase
      .from('songs')
      .select('status');

    if (songError) {
      throw new BadRequestException(`Failed to fetch song analytics: ${songError.message}`);
    }

    const totalSongs = songCounts?.length || 0;
    const pendingSongs = songCounts?.filter(s => s.status === 'pending').length || 0;
    const approvedSongs = songCounts?.filter(s => s.status === 'approved').length || 0;

    // Get total plays
    const { count: totalPlays, error: playsError } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true });

    if (playsError) {
      throw new BadRequestException(`Failed to fetch play analytics: ${playsError.message}`);
    }

    // Get total likes
    const { count: totalLikes, error: likesError } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true });

    if (likesError) {
      throw new BadRequestException(`Failed to fetch likes analytics: ${likesError.message}`);
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
      .select('id, email, display_name, role, avatar_url, created_at')
      .or('is_banned.eq.false,is_banned.is.null');

    if (filters.role && filters.role !== 'all') {
      query = query.eq('role', filters.role);
    }

    // Search by display name or email
    if (filters.search && filters.search.trim()) {
      query = query.or(`display_name.ilike.%${filters.search.trim()}%,email.ilike.%${filters.search.trim()}%`);
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
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
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
      throw new BadRequestException(`Failed to update user role: ${error.message}`);
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
        this.logger.log(`Revoked refresh tokens for user ${userId} (Firebase: ${user.firebase_uid})`);
      } catch (firebaseError) {
        this.logger.error(`Failed to revoke Firebase tokens: ${firebaseError.message}`);
      }
    }

    // 4. Delete FCM push tokens (stop notifications)
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

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
  async shadowBanUser(userId: string, adminId: string, reason: string): Promise<BanResult> {
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
      throw new BadRequestException(`Failed to shadow ban user: ${error.message}`);
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
  async restoreUser(userId: string): Promise<{ success: boolean; userId: string }> {
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
   * Lifetime ban / deactivate account: delete all artist songs and storage files,
   * clean user data, disable Firebase user. Keeps user record to prevent new signups.
   */
  async lifetimeBanUser(userId: string, adminId: string, reason: string): Promise<{ success: boolean; userId: string }> {
    const supabase = getSupabaseClient();

    // 1. Get user with firebase_uid
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, firebase_uid, email, display_name, avatar_url')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // 2. Get all songs by this artist
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('id, audio_url, artwork_url')
      .eq('artist_id', userId);

    if (!songsError && songs?.length) {
      const audioPaths: string[] = [];
      const artworkPaths: string[] = [];

      for (const song of songs) {
        if (song.audio_url) {
          const path = this.extractStoragePathFromUrl(song.audio_url, 'songs');
          if (path) audioPaths.push(path);
        }
        if (song.artwork_url) {
          const path = this.extractStoragePathFromUrl(song.artwork_url, 'artwork');
          if (path) artworkPaths.push(path);
        }
      }

      // Delete audio files from storage
      if (audioPaths.length) {
        const { error: audioErr } = await supabase.storage.from('songs').remove(audioPaths);
        if (audioErr) this.logger.warn(`Failed to delete some audio files: ${audioErr.message}`);
      }
      // Delete artwork files from storage
      if (artworkPaths.length) {
        const { error: artworkErr } = await supabase.storage.from('artwork').remove(artworkPaths);
        if (artworkErr) this.logger.warn(`Failed to delete some artwork files: ${artworkErr.message}`);
      }

      // Delete from admin_fallback_songs if any of these songs were added
      const audioUrls = songs.map((s) => s.audio_url).filter(Boolean);
      if (audioUrls.length) {
        for (const url of audioUrls) {
          await supabase.from('admin_fallback_songs').delete().eq('audio_url', url);
        }
      }
    }

    // 3. Delete user's avatar from storage if present
    if (user.avatar_url) {
      const avatarPath = this.extractStoragePathFromUrl(user.avatar_url, 'avatars');
      if (avatarPath) {
        await supabase.storage.from('avatars').remove([avatarPath]);
      }
    }

    // 4. Delete related data (order matters for FKs)
    await supabase.from('likes').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('push_tokens').delete().eq('user_id', userId);
    await supabase.from('credit_allocations').delete().eq('artist_id', userId);
    await supabase.from('credits').delete().eq('artist_id', userId);
    await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId);
    await supabase.from('songs').delete().eq('artist_id', userId);

    // 5. Revoke Firebase tokens
    if (user.firebase_uid) {
      try {
        const auth = getFirebaseAuth();
        await auth.revokeRefreshTokens(user.firebase_uid);
        await auth.updateUser(user.firebase_uid, { disabled: true });
        this.logger.log(`Disabled Firebase user ${user.firebase_uid} and revoked tokens`);
      } catch (firebaseErr: any) {
        this.logger.error(`Firebase update failed: ${firebaseErr?.message}`);
      }
    }

    // 6. Update user record: ban flags, clear PII, keep email/firebase_uid for blocking
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason,
        banned_by: adminId,
        display_name: null,
        avatar_url: null,
        role: 'listener',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw new BadRequestException(`Failed to update user: ${updateError.message}`);
    }

    this.logger.log(`Lifetime banned user ${userId}. Reason: ${reason}`);
    return { success: true, userId };
  }

  /**
   * Extract storage path from Supabase public URL.
   * URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
   */
  private extractStoragePathFromUrl(url: string, bucket: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const pattern = new RegExp(`/object/public/${bucket}/(.+)$`);
    const match = url.match(pattern);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Get all banned users (both hard and shadow banned).
   */
  async getBannedUsers(): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, is_banned, banned_at, ban_reason, is_shadow_banned, shadow_banned_at, shadow_ban_reason')
      .or('is_banned.eq.true,is_shadow_banned.eq.true')
      .order('banned_at', { ascending: false, nullsFirst: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch banned users: ${error.message}`);
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
      .select(`
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        credits_remaining, play_count, like_count,
        artist_id, created_at,
        users!songs_artist_id_fkey(id, display_name, email)
      `)
      .ilike('title', `%${query}%`)
      .eq('status', 'approved')
      .order('title', { ascending: true })
      .limit(limit);

    if (error) {
      throw new BadRequestException(`Failed to search songs: ${error.message}`);
    }

    // Add eligibility status to each song
    // NOTE: paid_play_count check is commented out for now - see README for details
    return (data || []).map(song => ({
      ...song,
      isEligibleForFreeRotation: 
        // song.paid_play_count > 0 && // DISABLED: Paid play requirement temporarily removed
        song.opt_in_free_play === true && 
        song.admin_free_rotation === true,
      eligibilityChecks: {
        hasPaidPlay: true, // song.paid_play_count > 0, // DISABLED: Always true for now
        artistOptedIn: song.opt_in_free_play === true,
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
      .select(`
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        credits_remaining, play_count, like_count,
        created_at
      `)
      .eq('artist_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to fetch user songs: ${error.message}`);
    }

    // Add eligibility status to each song
    // NOTE: paid_play_count check is commented out for now - see README for details
    return (data || []).map(song => ({
      ...song,
      isEligibleForFreeRotation: 
        // song.paid_play_count > 0 && // DISABLED: Paid play requirement temporarily removed
        song.opt_in_free_play === true && 
        song.admin_free_rotation === true,
      eligibilityChecks: {
        hasPaidPlay: true, // song.paid_play_count > 0, // DISABLED: Always true for now
        artistOptedIn: song.opt_in_free_play === true,
        adminApproved: song.admin_free_rotation === true,
      },
    }));
  }

  /**
   * Toggle free rotation status for a song (admin side).
   * NOTE: Paid play validation is temporarily disabled - see README for details.
   */
  async toggleFreeRotation(songId: string, enabled: boolean): Promise<any> {
    const supabase = getSupabaseClient();

    // If enabling, verify song meets requirements
    if (enabled) {
      const { data: song, error: fetchError } = await supabase
        .from('songs')
        .select('paid_play_count, opt_in_free_play, title')
        .eq('id', songId)
        .single();

      if (fetchError || !song) {
        throw new BadRequestException('Song not found');
      }

      // DISABLED: Paid play requirement temporarily removed - see README for details
      // if (song.paid_play_count < 1) {
      //   throw new BadRequestException(
      //     'Song must have at least 1 paid play before being added to free rotation'
      //   );
      // }

      if (!song.opt_in_free_play) {
        throw new BadRequestException(
          'Artist must opt-in to free play before admin can enable free rotation'
        );
      }
    }

    const { data, error } = await supabase
      .from('songs')
      .update({ admin_free_rotation: enabled })
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to toggle free rotation: ${error.message}`);
    }

    this.logger.log(`Free rotation ${enabled ? 'enabled' : 'disabled'} for song ${songId}`);
    return data;
  }

  /**
   * Get all songs currently in free rotation.
   * NOTE: paid_play_count requirement is temporarily disabled - see README for details.
   */
  async getSongsInFreeRotation(): Promise<any[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('songs')
      .select(`
        id, title, status, duration_seconds,
        opt_in_free_play, admin_free_rotation, paid_play_count,
        play_count, like_count, last_played_at,
        artist_id, created_at,
        users!songs_artist_id_fkey(id, display_name, email)
      `)
      .eq('status', 'approved')
      .eq('opt_in_free_play', true)
      .eq('admin_free_rotation', true)
      // .gt('paid_play_count', 0) // DISABLED: Paid play requirement temporarily removed
      .order('last_played_at', { ascending: true, nullsFirst: true });

    if (error) {
      throw new BadRequestException(`Failed to fetch free rotation songs: ${error.message}`);
    }

    return data || [];
  }
}
