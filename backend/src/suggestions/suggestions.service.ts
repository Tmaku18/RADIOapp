import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { stationIdsForGenres } from '../radio/station.constants';

export interface LocalArtistSuggestion {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  region: string | null;
  songCount?: number;
}

export interface GenreArtistSuggestion extends LocalArtistSuggestion {
  headline: string | null;
  matchedGenres: string[];
}

@Injectable()
export class SuggestionsService {
  /**
   * Returns artists in the user's area (same region).
   * Region = country or country-region (e.g. "US", "US-Georgia").
   * If user has no region, returns empty array.
   */
  async getLocalArtists(
    userRegion: string | null,
    limit = 10,
  ): Promise<LocalArtistSuggestion[]> {
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

  private seededShuffle<T>(items: T[], seed: string): T[] {
    return [...items].sort((a, b) => {
      const keyA =
        typeof a === 'object' && a && 'id' in a
          ? String((a as { id: string }).id)
          : String(a);
      const keyB =
        typeof b === 'object' && b && 'id' in b
          ? String((b as { id: string }).id)
          : String(b);
      const hash = (input: string) => {
        let h = 0;
        for (let i = 0; i < input.length; i += 1) {
          h = (h * 31 + input.charCodeAt(i)) >>> 0;
        }
        return h;
      };
      return hash(`${seed}:${keyA}`) - hash(`${seed}:${keyB}`);
    });
  }

  /**
   * Artists with approved songs on stations matching the selected genres.
   * Results are shuffled with an optional seed for stable-but-random ordering.
   */
  async getGenreArtists(params: {
    genreIds: string[];
    limit?: number;
    seed?: string;
    excludeUserId?: string;
  }): Promise<GenreArtistSuggestion[]> {
    const supabase = getSupabaseClient();
    const stationIds = stationIdsForGenres(params.genreIds);
    if (!stationIds.length) return [];

    const limit = Math.min(Math.max(params.limit ?? 12, 1), 24);
    const seed = (params.seed ?? '').trim() || new Date().toISOString().slice(0, 10);
    const artistMeta = new Map<
      string,
      { songCount: number; genres: Set<string> }
    >();

    for (const stationId of stationIds) {
      const { data: songs, error } = await supabase
        .from('songs')
        .select('artist_id, station_id, station_ids')
        .eq('status', 'approved')
        .eq('is_public', true)
        .or(`station_id.eq.${stationId},station_ids.cs.{${stationId}}`)
        .limit(800);
      if (error) {
        throw new Error(`Failed to load genre songs: ${error.message}`);
      }
      for (const row of songs ?? []) {
        const artistId = (row as { artist_id?: string }).artist_id;
        if (!artistId) continue;
        if (params.excludeUserId && artistId === params.excludeUserId) continue;
        const entry = artistMeta.get(artistId) ?? {
          songCount: 0,
          genres: new Set<string>(),
        };
        entry.songCount += 1;
        for (const genreId of params.genreIds) {
          const genreStations = stationIdsForGenres([genreId]);
          const songStationId = (row as { station_id?: string }).station_id;
          const songStationIds = (row as { station_ids?: string[] }).station_ids;
          const onGenre = genreStations.some(
            (sid) =>
              songStationId === sid ||
              (Array.isArray(songStationIds) && songStationIds.includes(sid)),
          );
          if (onGenre) entry.genres.add(genreId);
        }
        artistMeta.set(artistId, entry);
      }
    }

    if (!artistMeta.size) return [];

    const artistIds = [...artistMeta.keys()];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, region, headline')
      .eq('role', 'artist')
      .eq('discoverable', true)
      .eq('is_banned', false)
      .in('id', artistIds);
    if (usersError) {
      throw new Error(`Failed to load genre artists: ${usersError.message}`);
    }

    const suggestions: GenreArtistSuggestion[] = (users ?? []).map((u) => {
      const meta = artistMeta.get(u.id)!;
      return {
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        region: u.region,
        headline: u.headline ?? null,
        songCount: meta.songCount,
        matchedGenres: [...meta.genres],
      };
    });

    return this.seededShuffle(suggestions, seed).slice(0, limit);
  }
}
