import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getSupabaseClient } from '../config/supabase.config';

function getWeekStart(d: Date): string {
  const d2 = new Date(d);
  const day = d2.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d2.setUTCDate(d2.getUTCDate() + diff);
  d2.setUTCHours(0, 0, 0, 0);
  return d2.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class CompetitionCronService {
  private readonly logger = new Logger(CompetitionCronService.name);

  /**
   * Run daily at 00:05 UTC. If it's Monday, close last week's voting, compute top 7,
   * write weekly_winner and fill artist_spotlight for the next 7 days.
   */
  @Cron('5 0 * * *')
  async closeWeeklyVotingAndAssignSpotlight() {
    const now = new Date();
    const day = now.getUTCDay();
    if (day !== 1) return;

    const supabase = getSupabaseClient();
    const lastWeekStart = addDays(getWeekStart(now), -7);

    const { data: votes } = await supabase
      .from('weekly_votes')
      .select('song_id, rank')
      .eq('period_start_date', lastWeekStart);
    if (!votes?.length) {
      this.logger.log('No votes for last week, skipping spotlight assignment');
      return;
    }

    const scoreBySong: Record<string, number> = {};
    votes.forEach((v: any) => {
      const points = 8 - v.rank;
      scoreBySong[v.song_id] = (scoreBySong[v.song_id] || 0) + points;
    });
    const top7 = Object.entries(scoreBySong)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([songId]) => songId);

    const { data: songs } = await supabase.from('songs').select('id, artist_id').in('id', top7);
    if (!songs?.length) return;

    const winnerSongId = top7[0];
    const winnerSong = songs.find((s: any) => s.id === winnerSongId);
    if (winnerSong) {
      await supabase.from('weekly_winners').upsert(
        { period_start_date: lastWeekStart, artist_id: winnerSong.artist_id, song_id: winnerSongId },
        { onConflict: 'period_start_date' },
      );
    }

    const thisWeekStart = getWeekStart(now);
    const toSpotlight: { date: string; artist_id: string; song_id: string; source: string }[] = [];
    for (let i = 0; i < Math.min(7, songs.length); i++) {
      const s = songs[i];
      toSpotlight.push({
        date: addDays(thisWeekStart, i),
        artist_id: s.artist_id,
        song_id: top7[i],
        source: 'weekly_winner',
      });
    }
    for (const row of toSpotlight) {
      await supabase.from('artist_spotlight').upsert(row, { onConflict: 'date' });
    }
    this.logger.log(`Assigned spotlight for week starting ${thisWeekStart} (${toSpotlight.length} days)`);
  }
}
