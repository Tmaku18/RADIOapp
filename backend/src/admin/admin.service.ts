import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
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

  async updateSongStatus(songId: string, status: 'approved' | 'rejected', reason?: string) {
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

    // Build update object
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'rejected') {
      updateData.rejection_reason = reason || null;
      updateData.rejected_at = new Date().toISOString();
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

    // Create notification for artist
    const notificationType = status === 'approved' ? 'song_approved' : 'song_rejected';
    const notificationTitle = status === 'approved' ? 'Song Approved!' : 'Song Rejected';
    const notificationMessage = status === 'approved'
      ? `Your song "${existingSong.title}" has been approved and is now live!`
      : `Your song "${existingSong.title}" was not approved.${reason ? ` Reason: ${reason}` : ''} You have 48 hours to contact support.`;

    await supabase.from('notifications').insert({
      user_id: existingSong.artist_id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        songId,
        songTitle: existingSong.title,
        reason: reason || null,
      },
    });

    this.logger.log(`Song ${songId} ${status}. Notification sent to artist.`);

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
}
