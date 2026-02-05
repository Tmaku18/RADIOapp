import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

/** ISO week: Monday = start */
function getWeekStart(d: Date): string {
  const d2 = new Date(d);
  const day = d2.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d2.setUTCDate(d2.getUTCDate() + diff);
  d2.setUTCHours(0, 0, 0, 0);
  return d2.toISOString().slice(0, 10);
}

function getWeekEnd(d: Date): string {
  const start = new Date(getWeekStart(d) + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() + 6);
  return start.toISOString().slice(0, 10);
}

@Injectable()
export class CompetitionService {
  getCurrentWeek(): { periodStart: string; periodEnd: string; votingOpen: boolean } {
    const now = new Date();
    const periodStart = getWeekStart(now);
    const periodEnd = getWeekEnd(now);
    const today = now.toISOString().slice(0, 10);
    const votingOpen = today <= periodEnd;
    return { periodStart, periodEnd, votingOpen };
  }

  async submitVote(userId: string, songIds: string[]): Promise<{ ok: boolean }> {
    if (!songIds || songIds.length !== 7) throw new Error('Exactly 7 song IDs required (rank 1-7)');
    const supabase = getSupabaseClient();
    const { periodStart } = this.getCurrentWeek();

    const { data: existing } = await supabase
      .from('weekly_votes')
      .select('id')
      .eq('user_id', userId)
      .eq('period_start_date', periodStart)
      .limit(1);
    if (existing?.length) throw new Error('Already voted this week');

    const toInsert = songIds.map((songId, i) => ({
      user_id: userId,
      period_start_date: periodStart,
      song_id: songId,
      rank: i + 1,
    }));
    const { error } = await supabase.from('weekly_votes').insert(toInsert);
    if (error) throw new Error(`Failed to submit vote: ${error.message}`);
    return { ok: true };
  }

  async getWeeklyResults(periodStart: string): Promise<{ songId: string; artistId: string; artistName: string; rankScore: number }[]> {
    const supabase = getSupabaseClient();
    const { data: votes } = await supabase
      .from('weekly_votes')
      .select('song_id, rank')
      .eq('period_start_date', periodStart);
    if (!votes?.length) return [];
    const scoreBySong: Record<string, number> = {};
    votes.forEach((v: any) => {
      const points = 8 - v.rank;
      scoreBySong[v.song_id] = (scoreBySong[v.song_id] || 0) + points;
    });
    const sorted = Object.entries(scoreBySong)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
    const songIds = sorted.map(([id]) => id);
    const { data: songs } = await supabase
      .from('songs')
      .select('id, artist_id, artist_name')
      .in('id', songIds);
    const byId = new Map((songs || []).map((s: any) => [s.id, s]));
    return sorted.map(([songId, rankScore]) => {
      const s = byId.get(songId);
      return {
        songId,
        artistId: s?.artist_id,
        artistName: s?.artist_name ?? 'Artist',
        rankScore,
      };
    });
  }

  async getMonthlyWinners(year?: number, month?: number): Promise<{ year: number; month: number; artistId: string; artistName: string }[]> {
    const supabase = getSupabaseClient();
    let q = supabase.from('monthly_winners').select('year, month, artist_id').order('year', { ascending: false }).order('month', { ascending: false }).limit(12);
    if (year != null) q = q.eq('year', year);
    if (month != null) q = q.eq('month', month);
    const { data: rows } = await q;
    if (!rows?.length) return [];
    const ids = [...new Set(rows.map((r: any) => r.artist_id))];
    const { data: users } = await supabase.from('users').select('id, display_name').in('id', ids);
    const nameBy = new Map((users || []).map((u: any) => [u.id, u.display_name ?? 'Artist']));
    return rows.map((r: any) => ({
      year: r.year,
      month: r.month,
      artistId: r.artist_id,
      artistName: nameBy.get(r.artist_id) ?? 'Artist',
    }));
  }

  async getYearlyWinners(year?: number): Promise<{ year: number; artistId: string; artistName: string }[]> {
    const supabase = getSupabaseClient();
    let q = supabase.from('yearly_winners').select('year, artist_id').order('year', { ascending: false }).limit(10);
    if (year != null) q = q.eq('year', year);
    const { data: rows } = await q;
    if (!rows?.length) return [];
    const ids = rows.map((r: any) => r.artist_id);
    const { data: users } = await supabase.from('users').select('id, display_name').in('id', ids);
    const nameBy = new Map((users || []).map((u: any) => [u.id, u.display_name ?? 'Artist']));
    return rows.map((r: any) => ({
      year: r.year,
      artistId: r.artist_id,
      artistName: nameBy.get(r.artist_id) ?? 'Artist',
    }));
  }
}
