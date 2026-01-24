import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateSongDto } from './dto/create-song.dto';

@Injectable()
export class SongsService {
  async createSong(userId: string, createSongDto: CreateSongDto) {
    const supabase = getSupabaseClient();

    // Verify user is an artist or admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || (user.role !== 'artist' && user.role !== 'admin')) {
      throw new ForbiddenException('Only artists and admins can upload songs');
    }

    const { data, error } = await supabase
      .from('songs')
      .insert({
        artist_id: userId,
        title: createSongDto.title,
        artist_name: createSongDto.artistName,
        audio_url: createSongDto.audioUrl,
        artwork_url: createSongDto.artworkUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create song: ${error.message}`);
    }

    return data;
  }

  async getSongById(songId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Song not found');
    }

    return data;
  }

  async getSongs(filters: {
    artistId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();
    let query = supabase.from('songs').select('*');

    if (filters.artistId) {
      query = query.eq('artist_id', filters.artistId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }

    return data;
  }

  async likeSong(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    if (existingLike) {
      // Already liked, return current status
      return { liked: true };
    }

    // Like
    await supabase
      .from('likes')
      .insert({
        user_id: userId,
        song_id: songId,
      });
    return { liked: true };
  }

  async unlikeSong(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Delete like if it exists
    await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);

    return { liked: false };
  }

  async isLiked(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    return { liked: !!existingLike };
  }

  async toggleLike(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    if (existingLike) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      return { liked: false };
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({
          user_id: userId,
          song_id: songId,
        });
      return { liked: true };
    }
  }
}
