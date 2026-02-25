import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getSupabaseClient } from '../config/supabase.config';

function parseUtcHm(hm: string): { h: number; m: number } | null {
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

function getTodayWindowUtc(now: Date, startHm: string, durationMin: number): { start: Date; end: Date } | null {
  const start = parseUtcHm(startHm);
  if (!start || durationMin <= 0) return null;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  const windowStart = new Date(Date.UTC(y, mo, d, start.h, start.m, 0, 0));
  const windowEnd = new Date(windowStart.getTime() + durationMin * 60 * 1000);
  return { start: windowStart, end: windowEnd };
}

@Injectable()
export class DailyDiamondCronService {
  private readonly logger = new Logger(DailyDiamondCronService.name);

  /**
   * Runs every 5 minutes. If the Trial-by-Fire window has ended (today), and we haven't
   * snapped it yet, compute the winner from leaderboard_likes within the window and write daily_diamonds.
   */
  @Cron('*/5 * * * *')
  async snapshotIfWindowEnded() {
    const startHm = (process.env.TRIAL_BY_FIRE_START_UTC || '').trim();
    const durationMin = parseInt(process.env.TRIAL_BY_FIRE_DURATION_MIN || '0', 10);
    if (!startHm || !Number.isFinite(durationMin) || durationMin <= 0) return;

    const now = new Date();
    const w = getTodayWindowUtc(now, startHm, durationMin);
    if (!w) return;

    // Only snapshot after the window ends (with a small buffer).
    if (now.getTime() < w.end.getTime() + 10 * 1000) return;

    const supabase = getSupabaseClient();

    // If already snapped for this window, do nothing.
    const { data: existing } = await supabase
      .from('daily_diamonds')
      .select('id')
      .eq('window_start', w.start.toISOString())
      .eq('window_end', w.end.toISOString())
      .maybeSingle();
    if (existing?.id) return;

    // Load likes in window. (Scale note: windows are short; this is acceptable.)
    const { data: likes, error } = await supabase
      .from('leaderboard_likes')
      .select('song_id, created_at')
      .gte('created_at', w.start.toISOString())
      .lt('created_at', w.end.toISOString())
      .limit(20000);
    if (error) {
      this.logger.warn(`Failed to load leaderboard_likes for window: ${error.message}`);
      return;
    }

    const rows = (likes ?? []) as Array<{ song_id: string }>;
    if (rows.length === 0) {
      this.logger.log('Daily Diamond: no votes in window; skipping snapshot');
      return;
    }

    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.song_id, (counts.get(r.song_id) ?? 0) + 1);
    }

    let winnerSongId: string | null = null;
    let winnerVotes = -1;
    for (const [songId, votes] of counts.entries()) {
      if (votes > winnerVotes) {
        winnerSongId = songId;
        winnerVotes = votes;
      }
    }
    if (!winnerSongId) return;

    const { error: insErr } = await supabase.from('daily_diamonds').insert({
      window_start: w.start.toISOString(),
      window_end: w.end.toISOString(),
      song_id: winnerSongId,
      votes: winnerVotes,
    });
    if (insErr) {
      this.logger.warn(`Daily Diamond snapshot insert failed: ${insErr.message}`);
      return;
    }

    this.logger.log(`Daily Diamond crowned: song ${winnerSongId} with ${winnerVotes} votes`);
  }
}

