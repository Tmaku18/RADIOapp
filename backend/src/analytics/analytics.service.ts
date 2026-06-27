import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { RadioStateService } from '../radio/radio-state.service';
import { STATION_IDS } from '../radio/station.constants';

export interface DailyPlayCount {
  date: string;
  /** Radio spin / play events that day. */
  plays: number;
  /** Unique (song, listener) pairs that day. */
  listens: number;
  /** Unique listeners that day (each account once). */
  ears: number;
}

interface SongAnalytics {
  songId: string;
  title: string;
  artworkUrl: string | null;
  totalPlays: number;
  totalListens: number;
  paidPlays: number;
  freePlays: number;
  creditsUsed: number;
  creditsRemaining: number;
  likeCount: number;
  trialPlaysUsed: number;
  lastPlayedAt: string | null;
}

export interface DiscoverSwipeSongMetric {
  songId: string;
  title: string;
  rightSwipes: number;
  leftSwipes: number;
  avgDecisionMs: number | null;
}

export interface DiscoverSwipeAnalytics {
  days: number;
  rightSwipes: number;
  leftSwipes: number;
  totalSwipes: number;
  avgDecisionMs: number | null;
  bySong: DiscoverSwipeSongMetric[];
}

export interface ArtistAnalytics {
  /** Total radio play events (spins). */
  totalPlays: number;
  /** Unique listens: distinct (song, listener) pairs all-time. */
  totalListenCount: number;
  /** Unique listeners (each account/device once). */
  earsReached: number;
  listensThisWeek: number;
  listensThisMonth: number;
  earsReachedThisWeek: number;
  earsReachedThisMonth: number;
  totalPaidPlays: number;
  totalFreePlays: number;
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

  constructor(private readonly radioStateService: RadioStateService) {}

  /**
   * Per-song unique "Ears Reached" via get_song_ears_reached. Best-effort.
   */
  private async getEarsReachedBySongId(
    songIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (songIds.length === 0) return result;
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_song_ears_reached', {
        p_song_ids: songIds,
      });
      if (error || !data) return result;
      for (const row of data as Array<{
        song_id: string;
        ears: number | string | null;
      }>) {
        const value = Number(row.ears);
        if (Number.isFinite(value)) {
          result.set(row.song_id, Math.max(0, Math.round(value)));
        }
      }
    } catch {
      // RPC may not exist in this environment.
    }
    return result;
  }

  /**
   * Per-song unique listens (radio + profile + spotlight). Best-effort.
   */
  private async getListenCountBySongId(
    songIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (songIds.length === 0) return result;
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_song_listen_count', {
        p_song_ids: songIds,
      });
      if (error || !data) return result;
      for (const row of data as Array<{
        song_id: string;
        listens: number | string | null;
      }>) {
        const value = Number(row.listens);
        if (Number.isFinite(value)) {
          result.set(row.song_id, Math.max(0, Math.round(value)));
        }
      }
    } catch {
      // RPC may not exist in this environment.
    }
    return result;
  }

  /**
   * Artist-level unique ears (deduplicated across all songs). Best-effort.
   */
  private async getArtistEarsReached(artistId: string): Promise<number | null> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_artist_ears_reached', {
        p_artist_id: artistId,
      });
      if (error || data == null) return null;
      const value = Number(data);
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
      return null;
    }
  }

  private async getArtistEarsReachedSince(
    artistId: string,
    since: Date,
  ): Promise<number | null> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc(
        'get_artist_ears_reached_since',
        { p_artist_id: artistId, p_since: since.toISOString() },
      );
      if (error || data == null) return null;
      const value = Number(data);
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
      return null;
    }
  }

  private async getArtistListenCount(artistId: string): Promise<number | null> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_artist_listen_count', {
        p_artist_id: artistId,
      });
      if (error || data == null) return null;
      const value = Number(data);
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
      return null;
    }
  }

  private async getArtistListenCountSince(
    artistId: string,
    since: Date,
  ): Promise<number | null> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc(
        'get_artist_listen_count_since',
        { p_artist_id: artistId, p_since: since.toISOString() },
      );
      if (error || data == null) return null;
      const value = Number(data);
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
      return null;
    }
  }

  private async getPlatformListenCount(): Promise<number | null> {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_radio_listen_count');
      if (error || data == null) return null;
      const value = Number(data);
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
      return null;
    }
  }

  /** Active tuned-in listeners from heartbeats / presence (not stale Redis counters). */
  private async getPlatformLiveListenerCount(): Promise<number> {
    const windowSeconds = parseInt(
      process.env.LISTENER_HEARTBEAT_ACTIVE_WINDOW_SECONDS || '120',
      10,
    );
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.rpc('get_radio_live_listeners', {
        p_window_seconds: Number.isFinite(windowSeconds) ? windowSeconds : 120,
      });
      if (!error && data != null) {
        const value = Number(data);
        if (Number.isFinite(value)) return Math.max(0, Math.round(value));
      }
    } catch {
      // Fall back to legacy Redis totals below.
    }

    const counts = await Promise.all(
      STATION_IDS.map((stationId) =>
        this.radioStateService.getListenerCount(stationId),
      ),
    );
    return counts.reduce((sum, n) => sum + Math.max(0, n), 0);
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    const table = tableName.toLowerCase();
    if (maybe?.code === '42P01') {
      return message.includes(table) || message.includes(`public.${table}`);
    }
    if (maybe?.code === 'PGRST205') {
      return (
        message.includes(`'${table}'`) ||
        message.includes(`'public.${table}'`) ||
        message.includes(table)
      );
    }
    return false;
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    const column = columnName.toLowerCase();
    if (maybe?.code === '42703') {
      return message.includes(column);
    }
    if (maybe?.code === 'PGRST204') {
      return message.includes(`'${column}'`) || message.includes(column);
    }
    return false;
  }

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

  async getDiscoverSwipeAnalyticsForArtist(
    artistId: string,
    days: number = 30,
  ): Promise<DiscoverSwipeAnalytics> {
    const supabase = getSupabaseClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startIso = startDate.toISOString();

    const empty: DiscoverSwipeAnalytics = {
      days,
      rightSwipes: 0,
      leftSwipes: 0,
      totalSwipes: 0,
      avgDecisionMs: null,
      bySong: [],
    };

    let swipeRes = await supabase
      .from('discover_swipes')
      .select('song_id, direction, decision_ms, created_at')
      .eq('artist_id', artistId)
      .gte('created_at', startIso)
      .limit(10000);

    if (
      swipeRes.error &&
      this.isMissingTableError(swipeRes.error, 'discover_swipes')
    ) {
      return empty;
    }

    // Older schemas may not have artist_id on discover_swipes.
    if (
      swipeRes.error &&
      this.isMissingColumnError(swipeRes.error, 'artist_id')
    ) {
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id')
        .eq('artist_id', artistId);
      if (songsError || !songs?.length) {
        return empty;
      }
      const songIds = songs.map((s: any) => s.id as string);
      swipeRes = await supabase
        .from('discover_swipes')
        .select('song_id, direction, decision_ms, created_at')
        .in('song_id', songIds)
        .gte('created_at', startIso)
        .limit(10000);
      if (
        swipeRes.error &&
        this.isMissingTableError(swipeRes.error, 'discover_swipes')
      ) {
        return empty;
      }
      if (swipeRes.error) {
        throw new Error(
          `Failed to load discover swipe analytics: ${swipeRes.error.message}`,
        );
      }
    } else if (swipeRes.error) {
      throw new Error(
        `Failed to load discover swipe analytics: ${swipeRes.error.message}`,
      );
    }

    const swipeRows = (swipeRes.data || []) as Array<{
      song_id: string;
      direction: 'left_skip' | 'right_like';
      decision_ms: number | null;
    }>;

    const rightSwipes = swipeRows.filter(
      (r) => r.direction === 'right_like',
    ).length;
    const leftSwipes = swipeRows.filter(
      (r) => r.direction === 'left_skip',
    ).length;
    const totalSwipes = swipeRows.length;

    const decisionValues = swipeRows
      .map((r) => r.decision_ms)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const avgDecisionMs =
      decisionValues.length > 0
        ? Math.round(
            decisionValues.reduce((sum, current) => sum + current, 0) /
              decisionValues.length,
          )
        : null;

    const songIds = [...new Set(swipeRows.map((r) => r.song_id))];
    const { data: songs } =
      songIds.length > 0
        ? await supabase.from('songs').select('id, title').in('id', songIds)
        : { data: [] as any[] };
    const titleBySongId = new Map<string, string>(
      (songs || []).map((s: any) => [s.id as string, s.title as string]),
    );

    const bySongMap = new Map<
      string,
      { rightSwipes: number; leftSwipes: number; decisions: number[] }
    >();
    for (const row of swipeRows) {
      const metric = bySongMap.get(row.song_id) ?? {
        rightSwipes: 0,
        leftSwipes: 0,
        decisions: [],
      };
      if (row.direction === 'right_like') metric.rightSwipes += 1;
      if (row.direction === 'left_skip') metric.leftSwipes += 1;
      if (row.decision_ms != null && Number.isFinite(row.decision_ms)) {
        metric.decisions.push(row.decision_ms);
      }
      bySongMap.set(row.song_id, metric);
    }

    const bySong: DiscoverSwipeSongMetric[] = [...bySongMap.entries()]
      .map(([songId, metric]) => ({
        songId,
        title: titleBySongId.get(songId) ?? 'Untitled',
        rightSwipes: metric.rightSwipes,
        leftSwipes: metric.leftSwipes,
        avgDecisionMs:
          metric.decisions.length > 0
            ? Math.round(
                metric.decisions.reduce((sum, current) => sum + current, 0) /
                  metric.decisions.length,
              )
            : null,
      }))
      .sort(
        (a, b) => b.rightSwipes + b.leftSwipes - (a.rightSwipes + a.leftSwipes),
      )
      .slice(0, 20);

    return {
      days,
      rightSwipes,
      leftSwipes,
      totalSwipes,
      avgDecisionMs,
      bySong,
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
        totalListenCount: 0,
        earsReached: 0,
        listensThisWeek: 0,
        listensThisMonth: 0,
        earsReachedThisWeek: 0,
        earsReachedThisMonth: 0,
        totalPaidPlays: 0,
        totalFreePlays: 0,
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

    // Real per-song stats: aggregate from `plays` and `likes` via RPC so the
    // numbers reflect actual activity (cached counters on `songs` can drift,
    // and `song_profile_listens` does not exist in all environments).
    const playsCountBySongId = new Map<string, number>();
    const listenCountBySongId = new Map<string, number>();
    const likeCountBySongId = new Map<string, number>();
    {
      const { data: statsRows, error: statsError } = await supabase.rpc(
        'get_artist_song_stats',
        // p_since explicitly null = lifetime stats. Pass it so the call does
        // not depend on the SQL default arg (PostgREST resolves the overload
        // by named args; omitting p_since can break if the default is removed).
        { p_song_ids: songIds, p_since: null },
      );
      if (statsError) {
        this.logger.warn(
          `get_artist_song_stats RPC unavailable: ${statsError.message}`,
        );
      } else {
        for (const row of (statsRows ?? []) as Array<{
          song_id: string;
          plays_count: number | string | null;
          listener_count_sum: number | string | null;
          like_count: number | string | null;
        }>) {
          if (!row.song_id) continue;
          playsCountBySongId.set(row.song_id, Number(row.plays_count) || 0);
          listenCountBySongId.set(
            row.song_id,
            Number(row.listener_count_sum) || 0,
          );
          likeCountBySongId.set(row.song_id, Number(row.like_count) || 0);
        }
      }
    }

    const earsBySongId = await this.getEarsReachedBySongId(songIds);
    const listensBySongId = await this.getListenCountBySongId(songIds);
    for (const songId of songIds) {
      const listens = listensBySongId.get(songId);
      if (listens != null) {
        listenCountBySongId.set(songId, listens);
        continue;
      }
      const ears = earsBySongId.get(songId);
      if (ears != null) {
        listenCountBySongId.set(songId, ears);
      }
    }

    const artistEarsReached = await this.getArtistEarsReached(artistId);
    const artistListenCount = await this.getArtistListenCount(artistId);
    const summedSongListens = [...listenCountBySongId.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    const totalListenCount = Math.max(
      artistListenCount ?? 0,
      summedSongListens,
    );
    const earsReached = artistEarsReached ?? 0;
    const totalPaidPlays = (songs || []).reduce(
      (sum, song) => sum + (song.paid_play_count || 0),
      0,
    );
    const totalSongPlayCount = (songs || []).reduce(
      (sum, song) =>
        sum + (playsCountBySongId.get(song.id) ?? song.play_count ?? 0),
      0,
    );
    const totalFreePlays = Math.max(0, totalSongPlayCount - totalPaidPlays);

    // Get artist's credits
    const { data: credits } = await supabase
      .from('credits')
      .select('balance, total_used')
      .eq('artist_id', artistId)
      .single();

    // Total plays = sum of real per-song plays (RPC); fall back to a count query
    // when the RPC is unavailable.
    let totalPlays = 0;
    if (playsCountBySongId.size > 0) {
      totalPlays = totalSongPlayCount;
    } else {
      const { count } = await supabase
        .from('plays')
        .select('*', { count: 'exact', head: true })
        .in('song_id', songIds);
      totalPlays = count || 0;
    }

    // Total likes = sum of real per-song likes (RPC).
    const totalLikes = [...likeCountBySongId.values()].reduce(
      (sum, value) => sum + value,
      0,
    );

    // Daily breakdown for the last N days. Aggregated server-side via RPC so
    // we get accurate counts even when there are tens of thousands of plays
    // (a plain `select('played_at')` is silently capped at 1000 rows).
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dailyPlays = await this.getDailyStatsForArtist(
      songIds,
      startDate,
      days,
    );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const [
      earsReachedThisWeek,
      earsReachedThisMonth,
      listensThisWeek,
      listensThisMonth,
    ] = await Promise.all([
      this.getArtistEarsReachedSince(artistId, weekStart),
      this.getArtistEarsReachedSince(artistId, startDate),
      this.getArtistListenCountSince(artistId, weekStart),
      this.getArtistListenCountSince(artistId, startDate),
    ]);

    // Top songs ranked by ears reached, then play count, with real likes.
    const topSongs: SongAnalytics[] = songs
      .slice()
      .sort((a, b) => {
        const listenDelta =
          (listenCountBySongId.get(b.id) ?? 0) -
          (listenCountBySongId.get(a.id) ?? 0);
        if (listenDelta !== 0) return listenDelta;
        return (
          (playsCountBySongId.get(b.id) ?? b.play_count ?? 0) -
          (playsCountBySongId.get(a.id) ?? a.play_count ?? 0)
        );
      })
      .slice(0, 5)
      .map((song) => {
        const realPlays =
          playsCountBySongId.get(song.id) ?? (song.play_count || 0);
        return {
          songId: song.id,
          title: song.title,
          artworkUrl: song.artwork_url,
          totalPlays: realPlays,
          totalListens: listenCountBySongId.get(song.id) ?? 0,
          paidPlays: song.paid_play_count || 0,
          freePlays: Math.max(0, realPlays - (song.paid_play_count || 0)),
          creditsUsed:
            realPlays * Math.ceil((song.duration_seconds || 180) / 5),
          creditsRemaining: song.credits_remaining || 0,
          likeCount: likeCountBySongId.get(song.id) ?? (song.like_count || 0),
          trialPlaysUsed: song.trial_plays_used || 0,
          lastPlayedAt: song.last_played_at,
        };
      });

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
      totalPlays,
      totalListenCount,
      earsReached,
      listensThisWeek: listensThisWeek ?? 0,
      listensThisMonth: listensThisMonth ?? 0,
      earsReachedThisWeek: earsReachedThisWeek ?? 0,
      earsReachedThisMonth: earsReachedThisMonth ?? 0,
      totalPaidPlays,
      totalFreePlays,
      totalSongs: songs.length,
      totalLikes,
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

    // Total users in DB
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Artist accounts in DB
    const { count: totalArtists } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'artist');

    // Catalyst accounts in DB
    const { count: totalCatalysts } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'service_provider');

    // Songs in DB (all statuses)
    const { count: totalSongs } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true });

    // Approved songs (kept for dashboard/reference)
    const { count: totalApprovedSongs } = await supabase
      .from('songs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    // Total plays
    const { count: totalPlays } = await supabase
      .from('plays')
      .select('*', { count: 'exact', head: true });
    // Discoveries = profile clicks from radio/leaderboards (artist profile clicks)
    const { count: totalProfileClicks } = await supabase
      .from('profile_clicks')
      .select('*', { count: 'exact', head: true });

    // Total Ripples (likes) across the platform
    const { count: totalLikes } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true });

    // Live radio metrics (current listeners + cumulative unique ears). Folded
    // into the public platform payload so clients that only poll /platform
    // (e.g. the mobile welcome/about stats strip) still get real values.
    // Best-effort: never let a transient radio/Redis issue fail the totals.
    let liveListeners = 0;
    let earsReached = 0;
    let platformListenCount: number | null = null;
    try {
      const live = await this.getPlatformLiveStats();
      liveListeners = live.liveListeners;
      earsReached = live.earsReached;
    } catch (error) {
      this.logger.warn(
        `Live stats unavailable for platform payload: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
    platformListenCount = await this.getPlatformListenCount();

    return {
      totalUsers: totalUsers || 0,
      totalArtists: totalArtists || 0,
      totalCatalysts: totalCatalysts || 0,
      totalSongs: totalSongs || 0,
      totalApprovedSongs: totalApprovedSongs || 0,
      totalPlays: totalPlays || 0,
      totalListenCount: platformListenCount ?? 0,
      totalProfileClicks: totalProfileClicks || 0,
      totalLikes: totalLikes || 0,
      liveListeners,
      earsReached,
      listens: platformListenCount ?? 0,
    };
  }

  /**
   * Live radio metrics for the marketing homepage (poll every ~30s).
   */
  async getPlatformLiveStats(): Promise<{
    liveListeners: number;
    earsReached: number;
    listens: number;
  }> {
    const liveListeners = await this.getPlatformLiveListenerCount();

    const supabase = getSupabaseClient();
    let earsReached = 0;
    try {
      const { data: ears } = await supabase.rpc('get_radio_ears_reached');
      if (typeof ears === 'number') earsReached = ears;
      else if (ears != null) earsReached = Number(ears) || 0;
    } catch {
      earsReached = 0;
    }

    const platformListens = await this.getPlatformListenCount();
    const listens = platformListens ?? 0;

    return { liveListeners, earsReached, listens };
  }

  /**
   * Group plays by UTC date for chart data. Used by single-song analytics
   * where the dataset is small enough to scan rows directly.
   */
  private groupPlaysByDate(
    plays: { played_at: string }[],
    days: number,
  ): DailyPlayCount[] {
    const result: DailyPlayCount[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      result.push({
        date: date.toISOString().split('T')[0],
        plays: 0,
        listens: 0,
        ears: 0,
      });
    }
    plays.forEach((play) => {
      const playDate = play.played_at.split('T')[0];
      const dayEntry = result.find((d) => d.date === playDate);
      if (dayEntry) dayEntry.plays += 1;
    });
    return result;
  }

  /**
   * Aggregated daily stats for an artist's catalog (plays + listener
   * impressions per UTC day) sourced from the `get_artist_daily_stats` RPC.
   * Always returns one entry per day in the window so the chart aligns even
   * when there is no activity on some days.
   */
  private async getDailyStatsForArtist(
    songIds: string[],
    startDate: Date,
    days: number,
  ): Promise<DailyPlayCount[]> {
    const result: DailyPlayCount[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      result.push({
        date: date.toISOString().split('T')[0],
        plays: 0,
        listens: 0,
        ears: 0,
      });
    }

    if (songIds.length === 0) return result;

    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase.rpc(
      'get_artist_daily_stats',
      { p_song_ids: songIds, p_since: startDate.toISOString() },
    );
    if (error) {
      this.logger.warn(
        `get_artist_daily_stats RPC failed, falling back to row scan: ${error.message}`,
      );
      // Best-effort fallback for older environments. Capped at 1000 rows by
      // the REST layer; only used when the RPC is unavailable.
      const { data: dailyPlaysRaw } = await supabase
        .from('plays')
        .select('played_at')
        .in('song_id', songIds)
        .gte('played_at', startDate.toISOString());
      for (const play of (dailyPlaysRaw || []) as { played_at: string }[]) {
        const day = play.played_at.split('T')[0];
        const entry = result.find((d) => d.date === day);
        if (entry) entry.plays += 1;
      }
      return result;
    }

    for (const row of (rows ?? []) as Array<{
      day: string;
      plays_count: number | string | null;
      listener_count_sum: number | string | null;
    }>) {
      if (!row?.day) continue;
      const entry = result.find((d) => d.date === row.day);
      if (!entry) continue;
      entry.plays = Number(row.plays_count) || 0;
    }

    try {
      const { data: listenRows, error: listenError } = await supabase.rpc(
        'get_artist_daily_listens',
        { p_song_ids: songIds, p_since: startDate.toISOString() },
      );
      if (listenError) {
        this.logger.warn(
          `get_artist_daily_listens RPC unavailable: ${listenError.message}`,
        );
      } else {
        for (const row of (listenRows ?? []) as Array<{
          day: string;
          listens_count: number | string | null;
        }>) {
          if (!row?.day) continue;
          const entry = result.find((d) => d.date === row.day);
          if (!entry) continue;
          entry.listens = Number(row.listens_count) || 0;
        }
      }
    } catch {
      // Keep listener_count_sum fallback when daily listens RPC is unavailable.
    }

    try {
      const { data: earsRows, error: earsError } = await supabase.rpc(
        'get_artist_daily_ears_reached',
        { p_song_ids: songIds, p_since: startDate.toISOString() },
      );
      if (earsError) {
        this.logger.warn(
          `get_artist_daily_ears_reached RPC unavailable: ${earsError.message}`,
        );
      } else {
        for (const row of (earsRows ?? []) as Array<{
          day: string;
          ears_count: number | string | null;
        }>) {
          if (!row?.day) continue;
          const entry = result.find((d) => d.date === row.day);
          if (!entry) continue;
          entry.ears = Number(row.ears_count) || 0;
        }
      }
    } catch {
      // Keep prior fallbacks when daily ears RPC is unavailable.
    }

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
