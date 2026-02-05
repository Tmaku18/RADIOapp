import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface LeaderboardSong {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  likeCount?: number;
  spotlightListenCount?: number;
}

@Injectable()
export class LeaderboardService {
  /**
   * Songs ordered by leaderboard like count (from leaderboard_likes table).
   */
  async getSongsByLikes(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: countRows } = await supabase
      .from('leaderboard_likes')
      .select('song_id');
    const countBySong: Record<string, number> = {};
    countRows?.forEach((r: { song_id: string }) => {
      countBySong[r.song_id] = (countBySong[r.song_id] || 0) + 1;
    });
    const songIds = Object.entries(countBySong)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(offset, offset + limit);

    if (songIds.length === 0 && offset === 0) {
      const { data: anySongs } = await supabase
        .from('songs')
        .select('id, title, artist_name, artist_id, artwork_url')
        .eq('status', 'approved')
        .range(0, limit - 1)
        .order('created_at', { ascending: false });
      return (anySongs || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        artistName: s.artist_name,
        artistId: s.artist_id,
        artworkUrl: s.artwork_url,
        likeCount: 0,
      }));
    }

    if (songIds.length === 0) return [];

    const { data: songs } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url')
      .in('id', songIds)
      .eq('status', 'approved');

    const order = new Map(songIds.map((id, i) => [id, i]));
    const sorted = (songs || []).sort((a: any, b: any) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    return sorted.map((s: any) => ({
      id: s.id,
      title: s.title,
      artistName: s.artist_name,
      artistId: s.artist_id,
      artworkUrl: s.artwork_url,
      likeCount: countBySong[s.id] ?? 0,
    }));
  }

  /**
   * Songs ordered by spotlight_listen_count (listens leaderboard).
   */
  async getSongsByListens(limit: number, offset: number): Promise<LeaderboardSong[]> {
    const supabase = getSupabaseClient();
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, title, artist_name, artist_id, artwork_url, spotlight_listen_count')
      .eq('status', 'approved')
      .order('spotlight_listen_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch listens leaderboard: ${error.message}`);
    return (songs || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      artistName: s.artist_name,
      artistId: s.artist_id,
      artworkUrl: s.artwork_url,
      spotlightListenCount: s.spotlight_listen_count ?? 0,
    }));
  }

  /**
   * Record a leaderboard like (one per user per play). Idempotent if same user + play_id.
   */
  async addLeaderboardLike(userId: string, songId: string, playId: string | null): Promise<{ liked: boolean }> {
    const supabase = getSupabaseClient();
    if (playId) {
      const { data: existing } = await supabase
        .from('leaderboard_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('play_id', playId)
        .single();
      if (existing) return { liked: true };
    }

    const { error } = await supabase.from('leaderboard_likes').insert({
      user_id: userId,
      song_id: songId,
      play_id: playId,
    });
    if (error) {
      if (error.code === '23505') return { liked: true };
      throw new Error(`Failed to record leaderboard like: ${error.message}`);
    }
    return { liked: true };
  }
}
