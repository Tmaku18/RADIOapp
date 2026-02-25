import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface DailyPlayCount {
  date: string;
  plays: number;
}

interface SongAnalytics {
  songId: string;
  title: string;
  artworkUrl: string | null;
  totalPlays: number;
  creditsUsed: number;
  creditsRemaining: number;
  likeCount: number;
  trialPlaysUsed: number;
  lastPlayedAt: string | null;
}

export interface ArtistAnalytics {
  totalPlays: number;
  totalSongs: number;
  totalLikes: number;
  totalCreditsUsed: number;
  creditsRemaining: number;
  dailyPlays: DailyPlayCount[];
  topSongs: SongAnalytics[];
  recentPlays: any[];
}

/**
 * Analytics Service
 * Provides real-time and historical analytics for artists and platform.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  async getRoiForArtist(
    artistId: string,
    days: number = 30,
  ): Promise<{
    days: number;
    newFollowers: number;
    creditsSpentInWindow: number;
    roi: number | null;
  }> {
    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startIso = startDate.toISOString();

    const { count: newFollowers } = await supabase
      .from('artist_follows')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .gte('created_at', startIso);

    // Approximate "credits spent in window" as credits-per-play * number of plays in window.
    // (credits.total_used has no time dimension; this is the best windowed estimate.)
    const { data: songs } = await supabase
      .from('songs')
      .select('id, duration_seconds')
      .eq('artist_id', artistId);

    const songList = (songs ?? []) as Array<{
      id: string;
      duration_seconds: number | null;
    }>;
    if (songList.length === 0) {
      return {
        days,
        newFollowers: newFollowers ?? 0,
        creditsSpentInWindow: 0,
        roi: null,
      };
    }

    const creditsPerPlayBySongId = new Map<string, number>();
    for (const s of songList) {
      const duration = s.duration_seconds ?? 180;
      creditsPerPlayBySongId.set(s.id, Math.ceil(duration / 5));
    }

    const songIds = songList.map((s) => s.id);
    const { data: plays } = await supabase
      .from('plays')
      .select('song_id')
      .in('song_id', songIds)
      .gte('played_at', startIso);

    const playRows = (plays ?? []) as Array<{ song_id: string }>;
    const creditsSpentInWindow = playRows.reduce(
      (sum, p) => sum + (creditsPerPlayBySongId.get(p.song_id) ?? 0),
      0,
    );
    const roi =
      creditsSpentInWindow > 0
        ? ((newFollowers ?? 0) / creditsSpentInWindow) * 100
        : null;

    return {
      days,
      newFollowers: newFollowers ?? 0,
      creditsSpentInWindow,
      roi,
    };
  }

  async getPlaysByRegionForArtist(
    artistId: string,
    days: number = 30,
  ): Promise<Array<{ region: string; count: number }>> {
    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startIso = startDate.toISOString();

    // We don't currently store geo on plays, so we use profile clicks as a proxy for "where listeners engaged from".
    const { data, error } = await supabase
      .from('profile_clicks')
      .select('user_id, users(region, location_region, discoverable)')
      .eq('artist_id', artistId)
      .gte('created_at', startIso)
      .limit(5000);

    if (error) {
      this.logger.warn(
        `Failed to load plays-by-region proxy for artist ${artistId}: ${error.message}`,
      );
      return [];
    }

    const rows = (data ?? []) as Array<{
      user_id: string;
      users?: {
        region?: string | null;
        location_region?: string | null;
        discoverable?: boolean | null;
      } | null;
    }>;

    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.users?.discoverable === false) continue;
      const region = r.users?.region ?? r.users?.location_region ?? 'Unknown';
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get comprehensive analytics for an artist.
   */
  async getArtistAnalytics(
    artistId: string,
    days: number = 30,
  ): Promise<ArtistAnalytics> {
    const supabase = getSupabaseClient();

    // Get artist's songs
    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('artist_id', artistId);

    if (!songs || songs.length === 0) {
      return {
        totalPlays: 0,
        totalSongs: 0,
        totalLikes: 0,
        totalCreditsUsed: 0,
        creditsRemaining: 0,
        dailyPlays: [],
        topSongs: [],
        recentPlays: [],
      };
    }

    const songIds = songs.map((s) => s.id);

    // Get artist's credits
    const { data: credits } = await supabase
      .from('credits')
      .select('balance, total_used')
      .eq('artist_id', artistId)
      .single();

    // Get total plays for artist's songs
    const { count: totalPlays } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true })
      .in('song_id', songIds);

    // Get total likes for artist's songs
    const { count: totalLikes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .in('song_id', songIds);

    // Get daily play breakdown for the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: dailyPlaysRaw } = await supabase
      .from('plays')
      .select('played_at')
      .in('song_id', songIds)
      .gte('played_at', startDate.toISOString())
      .order('played_at', { ascending: true });

    // Group plays by date
    const dailyPlays = this.groupPlaysByDate(dailyPlaysRaw || [], days);

    // Get top songs by play count
    const topSongs: SongAnalytics[] = songs
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 5)
      .map((song) => ({
        songId: song.id,
        title: song.title,
        artworkUrl: song.artwork_url,
        totalPlays: song.play_count || 0,
        creditsUsed:
          (song.play_count || 0) *
          Math.ceil((song.duration_seconds || 180) / 5),
        creditsRemaining: song.credits_remaining || 0,
        likeCount: song.like_count || 0,
        trialPlaysUsed: song.trial_plays_used || 0,
        lastPlayedAt: song.last_played_at,
      }));

    // Get recent plays
    const { data: recentPlays } = await supabase
      .from('plays')
      .select(
        `
        id,
        played_at,
        listener_count,
        songs:song_id (
          id,
          title,
          artwork_url
        )
      `,
      )
      .in('song_id', songIds)
      .order('played_at', { ascending: false })
      .limit(10);

    return {
      totalPlays: totalPlays || 0,
      totalSongs: songs.length,
      totalLikes: totalLikes || 0,
      totalCreditsUsed: credits?.total_used || 0,
      creditsRemaining: credits?.balance || 0,
      dailyPlays,
      topSongs,
      recentPlays: recentPlays || [],
    };
  }

  /**
   * Get analytics for a specific song.
   */
  async getSongAnalytics(songId: string, days: number = 30) {
    const supabase = getSupabaseClient();

    const { data: song } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (!song) {
      return null;
    }

    // Get play count from plays table
    const { count: totalPlays } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', songId);

    // Get likes count
    const { count: totalLikes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('song_id', songId);

    // Get daily play breakdown
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: dailyPlaysRaw } = await supabase
      .from('plays')
      .select('played_at')
      .eq('song_id', songId)
      .gte('played_at', startDate.toISOString())
      .order('played_at', { ascending: true });

    const dailyPlays = this.groupPlaysByDate(dailyPlaysRaw || [], days);

    // Get play decision log for this song
    const { data: decisionLog } = await supabase
      .from('play_decision_log')
      .select('*')
      .eq('song_id', songId)
      .order('selected_at', { ascending: false })
      .limit(20);

    return {
      song: {
        id: song.id,
        title: song.title,
        artistName: song.artist_name,
        artworkUrl: song.artwork_url,
        status: song.status,
        createdAt: song.created_at,
      },
      stats: {
        totalPlays: totalPlays || song.play_count || 0,
        totalLikes: totalLikes || song.like_count || 0,
        skipCount: song.skip_count || 0,
        creditsRemaining: song.credits_remaining || 0,
        trialPlaysRemaining: song.trial_plays_remaining || 0,
        trialPlaysUsed: song.trial_plays_used || 0,
      },
      dailyPlays,
      decisionLog: decisionLog || [],
    };
  }

  /**
   * Get platform-wide statistics (for marketing page).
   */
  async getPlatformStats() {
    const supabase = getSupabaseClient();

    // Total users by role
    const { data: users } = await supabase.from('users').select('role');

    const totalUsers = users?.length || 0;
    const totalArtists = users?.filter((u) => u.role === 'artist').length || 0;

    // Total songs
    const { count: totalSongs } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Total plays (kept for backward compatibility; not used for Discoveries on homepage)
    const { count: totalPlays } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true });

    // Discoveries = profile clicks from radio/leaderboards (artist profile clicks)
    const { count: totalProfileClicks } = await supabase
      .from('profile_clicks')
      .select('*', { count: 'exact', head: true });

    return {
      totalUsers,
      totalArtists,
      totalSongs: totalSongs || 0,
      totalPlays: totalPlays || 0,
      totalProfileClicks: totalProfileClicks || 0,
    };
  }

  /**
   * Group plays by date for chart data.
   */
  private groupPlaysByDate(
    plays: { played_at: string }[],
    days: number,
  ): DailyPlayCount[] {
    const result: DailyPlayCount[] = [];
    const now = new Date();

    // Initialize all days with 0 plays
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      result.push({
        date: date.toISOString().split('T')[0],
        plays: 0,
      });
    }

    // Count plays per day
    plays.forEach((play) => {
      const playDate = play.played_at.split('T')[0];
      const dayEntry = result.find((d) => d.date === playDate);
      if (dayEntry) {
        dayEntry.plays++;
      }
    });

    return result;
  }

  /**
   * Get a single play with per-play analytics (for "Your song has been played" notification deep link).
   * Only the artist who owns the song can view.
   */
  async getPlayById(playId: string, artistId: string) {
    const supabase = getSupabaseClient();

    const { data: play, error: playError } = await supabase
      .from('plays')
      .select(
        `
        id,
        song_id,
        played_at,
        listener_count,
        listener_count_at_end,
        likes_during,
        comments_during,
        disconnects_during,
        profile_clicks_during,
        skipped
      `,
      )
      .eq('id', playId)
      .single();

    if (playError || !play) {
      return null;
    }

    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, title, artist_id, artwork_url')
      .eq('id', play.song_id)
      .single();

    if (songError || !song || song.artist_id !== artistId) {
      return null;
    }

    const netListenerChange =
      play.listener_count_at_end != null && play.listener_count != null
        ? play.listener_count_at_end - play.listener_count
        : null;

    return {
      id: play.id,
      songId: play.song_id,
      songTitle: song.title,
      artworkUrl: song.artwork_url,
      playedAt: play.played_at,
      listenersAtStart: play.listener_count ?? 0,
      listenersAtEnd: play.listener_count_at_end ?? null,
      netListenerChange,
      likesDuring: play.likes_during ?? 0,
      commentsDuring: play.comments_during ?? 0,
      disconnectsDuring: play.disconnects_during ?? 0,
      profileClicksDuring: play.profile_clicks_during ?? 0,
      skipped: play.skipped ?? false,
    };
  }
}
