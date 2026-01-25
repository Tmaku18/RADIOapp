import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

interface DailyPlayCount {
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

interface ArtistAnalytics {
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

  /**
   * Get comprehensive analytics for an artist.
   */
  async getArtistAnalytics(artistId: string, days: number = 30): Promise<ArtistAnalytics> {
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

    const songIds = songs.map(s => s.id);

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
      .map(song => ({
        songId: song.id,
        title: song.title,
        artworkUrl: song.artwork_url,
        totalPlays: song.play_count || 0,
        creditsUsed: (song.play_count || 0) * Math.ceil((song.duration_seconds || 180) / 5),
        creditsRemaining: song.credits_remaining || 0,
        likeCount: song.like_count || 0,
        trialPlaysUsed: song.trial_plays_used || 0,
        lastPlayedAt: song.last_played_at,
      }));

    // Get recent plays
    const { data: recentPlays } = await supabase
      .from('plays')
      .select(`
        id,
        played_at,
        listener_count,
        songs:song_id (
          id,
          title,
          artwork_url
        )
      `)
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
    const { data: users } = await supabase
      .from('users')
      .select('role');

    const totalUsers = users?.length || 0;
    const totalArtists = users?.filter(u => u.role === 'artist').length || 0;

    // Total songs
    const { count: totalSongs } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Total plays
    const { count: totalPlays } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true });

    return {
      totalUsers,
      totalArtists,
      totalSongs: totalSongs || 0,
      totalPlays: totalPlays || 0,
    };
  }

  /**
   * Group plays by date for chart data.
   */
  private groupPlaysByDate(plays: { played_at: string }[], days: number): DailyPlayCount[] {
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
    plays.forEach(play => {
      const playDate = play.played_at.split('T')[0];
      const dayEntry = result.find(d => d.date === playDate);
      if (dayEntry) {
        dayEntry.plays++;
      }
    });

    return result;
  }
}
