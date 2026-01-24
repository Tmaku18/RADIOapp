import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class AdminService {
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

  async updateSongStatus(songId: string, status: 'approved' | 'rejected') {
    const supabase = getSupabaseClient();

    // Check if song exists
    const { data: existingSong, error: fetchError } = await supabase
      .from('songs')
      .select('id, status')
      .eq('id', songId)
      .single();

    if (fetchError || !existingSong) {
      throw new NotFoundException('Song not found');
    }

    // Update the song status
    const { data, error } = await supabase
      .from('songs')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update song status: ${error.message}`);
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
