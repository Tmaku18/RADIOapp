import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

/** ISO week: Monday = start of week */
function getWeekStart(d: Date): Date {
  const d2 = new Date(d);
  const day = d2.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d2.setUTCDate(d2.getUTCDate() + diff);
  d2.setUTCHours(0, 0, 0, 0);
  return d2;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class SpotlightService {
  async getToday(): Promise<{ artistId: string; artistName: string; songId: string | null; songTitle: string | null } | null> {
    const supabase = getSupabaseClient();
    const today = toDateStr(new Date());
    const { data } = await supabase
      .from('artist_spotlight')
      .select('artist_id, song_id')
      .eq('date', today)
      .single();
    if (!data) return null;
    const { data: artist } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', data.artist_id)
      .single();
    let songTitle: string | null = null;
    if (data.song_id) {
      const { data: song } = await supabase.from('songs').select('title').eq('id', data.song_id).single();
      songTitle = song?.title ?? null;
    }
    return {
      artistId: data.artist_id,
      artistName: artist?.display_name ?? 'Artist',
      songId: data.song_id,
      songTitle,
    };
  }

  async getWeek(startDate: string): Promise<Array<{ date: string; artistId: string; artistName: string; songId: string | null }>> {
    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('artist_spotlight')
      .select('date, artist_id, song_id')
      .gte('date', startDate)
      .lt('date', new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('date', { ascending: true });
    if (!rows?.length) return [];
    const artistIds = [...new Set(rows.map((r: any) => r.artist_id))];
    const { data: users } = await supabase.from('users').select('id, display_name').in('id', artistIds);
    const nameBy = new Map((users || []).map((u: any) => [u.id, u.display_name ?? 'Artist']));
    return rows.map((r: any) => ({
      date: r.date,
      artistId: r.artist_id,
      artistName: nameBy.get(r.artist_id) ?? 'Artist',
      songId: r.song_id,
    }));
  }

  async canListenUnlimited(artistId: string, songId: string): Promise<{ allowed: boolean; context?: string }> {
    const supabase = getSupabaseClient();
    const today = toDateStr(new Date());
    const weekStart = toDateStr(getWeekStart(new Date()));
    const nextMonthStart = new Date();
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1, 1);
    nextMonthStart.setUTCHours(0, 0, 0, 0);
    const monthStart = toDateStr(new Date(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() - 1, 1));

    const { data: todaySpotlight } = await supabase
      .from('artist_spotlight')
      .select('artist_id, song_id')
      .eq('date', today)
      .single();
    if (todaySpotlight?.artist_id === artistId && todaySpotlight?.song_id === songId) {
      return { allowed: true, context: 'featured_replay' };
    }
    if (todaySpotlight?.artist_id === artistId) {
      return { allowed: true, context: 'featured_replay' };
    }

    const { data: weekWinner } = await supabase
      .from('weekly_winners')
      .select('artist_id')
      .eq('period_start_date', weekStart)
      .single();
    if (weekWinner?.artist_id === artistId) {
      return { allowed: true, context: 'artist_of_week' };
    }

    const now = new Date();
    const m = now.getUTCMonth();
    const prevMonthDb = m === 0 ? 12 : m;
    const prevYearDb = m === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const { data: monthWinner } = await supabase
      .from('monthly_winners')
      .select('artist_id')
      .eq('year', prevYearDb)
      .eq('month', prevMonthDb)
      .single();
    if (monthWinner?.artist_id === artistId) {
      return { allowed: true, context: 'artist_of_month' };
    }
    return { allowed: false };
  }

  async recordListen(userId: string, songId: string, artistId: string, context: 'featured_replay' | 'artist_of_week' | 'artist_of_month'): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('spotlight_listens').insert({
      user_id: userId,
      song_id: songId,
      artist_id: artistId,
      source: context,
    });
    if (error) throw new Error(`Failed to record spotlight listen: ${error.message}`);
  }
}
