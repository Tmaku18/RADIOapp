import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateSongDto } from './dto/create-song.dto';

@Injectable()
export class SongsService {
  private async maybeEmitRisingStarForCurrentPlay(songId: string): Promise<void> {
    const supabase = getSupabaseClient();

    try {
      // rotation_queue position 0 is the current "now playing" state (DB fallback for Redis).
      const { data: rotation } = await supabase
        .from('rotation_queue')
        .select('song_id, played_at')
        .eq('position', 0)
        .single();

      const currentSongIdRaw = rotation?.song_id as string | undefined;
      const playedAtIso = rotation?.played_at as string | undefined;
      if (!currentSongIdRaw || !playedAtIso) return;

      const isAdmin = currentSongIdRaw.startsWith('admin:');
      const currentSongId = currentSongIdRaw.replace(/^admin:|^song:/, '');
      if (isAdmin) return;
      if (currentSongId !== songId) return;

      const playedAtMs = new Date(playedAtIso).getTime();
      if (!Number.isFinite(playedAtMs)) return;
      const lowerIso = new Date(playedAtMs - 5000).toISOString();

      const { data: playRows } = await supabase
        .from('plays')
        .select('id, listener_count, played_at')
        .eq('song_id', songId)
        .gte('played_at', lowerIso)
        .order('played_at', { ascending: false })
        .limit(1);

      const play = (playRows ?? [])[0] as { id: string; listener_count: number | null; played_at: string } | undefined;
      if (!play?.id) return;
      const listenersAtStart = play.listener_count ?? 0;
      if (listenersAtStart <= 0) return;

      const { count: likesDuring } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', songId)
        .gte('created_at', playedAtIso);

      const likes = likesDuring ?? 0;
      const conversion = likes / listenersAtStart;
      if (conversion < 0.05) return;

      const { data: song } = await supabase
        .from('songs')
        .select('title, artist_name, artist_id')
        .eq('id', songId)
        .single();

      const payload = {
        type: 'rising_star',
        songId,
        playId: play.id,
        songTitle: song?.title ?? 'A song',
        artistId: song?.artist_id ?? null,
        artistName: song?.artist_name ?? 'An artist',
        likesDuring: likes,
        listenersAtStart,
        conversion,
      };

      const { error } = await supabase.from('station_events').insert({
        station_id: 'global',
        type: 'rising_star',
        play_id: play.id,
        song_id: songId,
        payload,
      });

      if (error) {
        // Unique constraint prevents spam; ignore duplicates.
        if (error.code === '23505') return;
      }
    } catch {
      // Best-effort only; never break liking.
      return;
    }
  }

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
        duration_seconds: createSongDto.durationSeconds || 180, // Default 3 min if not provided
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

  async recordProfileListen(songId: string, userId: string | null): Promise<{ recorded: true }> {
    const supabase = getSupabaseClient();

    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, artist_id, status')
      .eq('id', songId)
      .single();

    if (songErr || !song) {
      throw new NotFoundException('Song not found');
    }
    if ((song as any).status !== 'approved') {
      throw new ForbiddenException('Song is not available');
    }

    const { error } = await supabase.from('song_profile_listens').insert({
      song_id: songId,
      artist_id: (song as any).artist_id,
      user_id: userId,
    });
    if (error) {
      throw new Error(`Failed to record profile listen: ${error.message}`);
    }
    return { recorded: true };
  }
}
