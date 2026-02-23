import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class RefineryService {
  private readonly logger = new Logger(RefineryService.name);

  /**
   * List songs currently in The Refinery (Prospector-only portal).
   * Only songs with in_refinery = true; order by created_at desc.
   */
  async listRefinerySongs(limit = 100, offset = 0) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, artwork_url, audio_url, duration_seconds, created_at')
      .eq('in_refinery', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.warn(`listRefinerySongs: ${error.message}`);
      throw new BadRequestException('Failed to load Refinery songs');
    }
    return { songs: data ?? [], limit, offset };
  }

  /**
   * Artist adds their own song to The Refinery (for review by Prospectors).
   */
  async addSongToRefinery(songId: string, artistUserId: string) {
    const supabase = getSupabaseClient();
    const { data: song, error: fetchErr } = await supabase
      .from('songs')
      .select('id, artist_id, status')
      .eq('id', songId)
      .single();

    if (fetchErr || !song) throw new BadRequestException('Song not found');
    if ((song as { artist_id: string }).artist_id !== artistUserId) {
      throw new ForbiddenException('You can only add your own songs to The Refinery');
    }

    const { error: upErr } = await supabase
      .from('songs')
      .update({ in_refinery: true, updated_at: new Date().toISOString() })
      .eq('id', songId);

    if (upErr) throw new BadRequestException('Failed to add song to Refinery');
    return { added: true, songId };
  }

  /**
   * Artist removes their song from The Refinery.
   */
  async removeSongFromRefinery(songId: string, artistUserId: string) {
    const supabase = getSupabaseClient();
    const { data: song, error: fetchErr } = await supabase
      .from('songs')
      .select('id, artist_id')
      .eq('id', songId)
      .single();

    if (fetchErr || !song) throw new BadRequestException('Song not found');
    if ((song as { artist_id: string }).artist_id !== artistUserId) {
      throw new ForbiddenException('You can only remove your own songs from The Refinery');
    }

    const { error: upErr } = await supabase
      .from('songs')
      .update({ in_refinery: false, updated_at: new Date().toISOString() })
      .eq('id', songId);

    if (upErr) throw new BadRequestException('Failed to remove song from Refinery');
    return { removed: true, songId };
  }

  /**
   * Get comments for a refinery song. Song must be in_refinery.
   */
  async getComments(songId: string, limit = 50, offset = 0) {
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, in_refinery')
      .eq('id', songId)
      .single();

    if (!song || !(song as { in_refinery: boolean }).in_refinery) {
      throw new BadRequestException('Song not found or not in The Refinery');
    }

    const { data, error } = await supabase
      .from('refinery_comments')
      .select(`
        id,
        user_id,
        body,
        created_at,
        users:user_id ( display_name )
      `)
      .eq('song_id', songId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException('Failed to load comments');
    return { comments: data ?? [], limit, offset };
  }

  /**
   * Prospector (listener) adds a comment on a refinery song.
   */
  async addComment(songId: string, userId: string, body: string) {
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, in_refinery')
      .eq('id', songId)
      .single();

    if (!song || !(song as { in_refinery: boolean }).in_refinery) {
      throw new BadRequestException('Song not found or not in The Refinery');
    }
    const trimmed = (body ?? '').trim();
    if (!trimmed) throw new BadRequestException('Comment body is required');

    const { data: inserted, error } = await supabase
      .from('refinery_comments')
      .insert({
        user_id: userId,
        song_id: songId,
        body: trimmed,
        updated_at: new Date().toISOString(),
      })
      .select('id, body, created_at')
      .single();

    if (error) throw new BadRequestException('Failed to add comment');
    return inserted;
  }
}
