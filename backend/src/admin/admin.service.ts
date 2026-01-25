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

    // Default to pending if no status specified
    const status = filters.status || 'pending';
    query = query.eq('status', status);

    query = query.order('created_at', { ascending: true });

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
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('users')
      .select('id, email, display_name, role, avatar_url, created_at');

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    query = query.order('created_at', { ascending: false });

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
}
