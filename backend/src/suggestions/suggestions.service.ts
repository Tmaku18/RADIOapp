import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface LocalArtistSuggestion {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  region: string | null;
  songCount?: number;
}

@Injectable()
export class SuggestionsService {
  /**
   * Returns artists in the user's area (same region).
   * Region = country or country-region (e.g. "US", "US-Georgia").
   * If user has no region, returns empty array.
   */
  async getLocalArtists(userRegion: string | null, limit = 10): Promise<LocalArtistSuggestion[]> {
    const supabase = getSupabaseClient();
    if (!userRegion?.trim()) {
      return [];
    }

    const { data: artists, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, region')
      .eq('role', 'artist')
      .eq('region', userRegion.trim())
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch local artists: ${error.message}`);
    }

    if (!artists?.length) return [];

    const ids = artists.map((a) => a.id);
    const { data: counts } = await supabase
      .from('songs')
      .select('artist_id')
      .in('artist_id', ids)
      .eq('status', 'approved');

    const countByArtist: Record<string, number> = {};
    counts?.forEach((r: { artist_id: string }) => {
      countByArtist[r.artist_id] = (countByArtist[r.artist_id] || 0) + 1;
    });

    return artists.map((a) => ({
      id: a.id,
      displayName: a.display_name,
      avatarUrl: a.avatar_url,
      region: a.region,
      songCount: countByArtist[a.id] ?? 0,
    }));
  }
}
