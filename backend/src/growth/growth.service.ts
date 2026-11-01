import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getSupabaseClient } from '../config/supabase.config';
import { PushQueueService } from '../push-notifications/push-queue.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** True when `hour` (0-23) falls inside a quiet window that may cross midnight. */
export function isQuietHour(
  start: number | null | undefined,
  end: number | null | undefined,
  hour: number,
): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

@Injectable()
export class GrowthService {
  private readonly logger = new Logger(GrowthService.name);

  constructor(private readonly push: PushQueueService) {}

  async search(rawQuery: string) {
    const query = rawQuery.trim().slice(0, 80);
    if (query.length < 2) return { songs: [], people: [] };
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('search_catalog', {
      p_query: query,
      p_limit: 12,
    });
    if (!error && Array.isArray(data)) {
      return this.splitSearchRows(data);
    }
    return this.searchFallback(query);
  }

  private splitSearchRows(rows: any[]) {
    const songs: Array<Record<string, unknown>> = [];
    const people: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      const item = {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        imageUrl: row.image_url,
      };
      if (row.kind === 'song') songs.push(item);
      else people.push(item);
    }
    return { songs, people };
  }

  private async searchFallback(query: string) {
    const supabase = getSupabaseClient();
    const safe = query.replace(/[%_,.()\\]/g, '');
    if (safe.length < 2) return { songs: [], people: [] };
    const like = `%${safe}%`;
    const [songsRes, peopleRes] = await Promise.all([
      supabase
        .from('songs')
        .select('id, title, artist_name, artwork_url')
        .or(`title.ilike.${like},artist_name.ilike.${like}`)
        .limit(12),
      supabase
        .from('users')
        .select('id, display_name, username, avatar_url, role')
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .eq('is_banned', false)
        .limit(12),
    ]);
    return {
      songs: (songsRes.data ?? []).map((s: any) => ({
        id: s.id,
        title: s.title,
        subtitle: s.artist_name,
        imageUrl: s.artwork_url,
      })),
      people: (peopleRes.data ?? []).map((u: any) => ({
        id: u.id,
        title: u.display_name ?? u.username,
        subtitle: u.username ?? u.role,
        imageUrl: u.avatar_url,
      })),
    };
  }

  async referralProfile(userId: string) {
    const code = await this.ensureReferralCode(userId);
    const supabase = getSupabaseClient();
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by_user_id', userId);
    return { code, invited: count ?? 0 };
  }

  async ensureReferralCode(userId: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();
    if (data?.referral_code) return data.referral_code as string;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = makeReferralCode();
      const { error } = await supabase
        .from('users')
        .update({ referral_code: code })
        .eq('id', userId)
        .is('referral_code', null);
      if (!error) return code;
    }
    const { data: again } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();
    if (again?.referral_code) return again.referral_code as string;
    throw new BadRequestException('Could not create a referral code.');
  }

  async claimReferral(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(code)) {
      throw new BadRequestException('Enter the referral code you were given.');
    }
    const supabase = getSupabaseClient();
    const { data: me } = await supabase
      .from('users')
      .select('id, referred_by_user_id')
      .eq('id', userId)
      .maybeSingle();
    if (!me) throw new BadRequestException('Account not found.');
    if (me.referred_by_user_id) return { claimed: false, reason: 'already' };
    const { data: referrer } = await supabase
      .from('users')
      .select('id, role')
      .eq('referral_code', code)
      .maybeSingle();
    if (!referrer || referrer.id === userId) {
      throw new BadRequestException('That referral code was not found.');
    }
    const { error } = await supabase
      .from('users')
      .update({ referred_by_user_id: referrer.id })
      .eq('id', userId)
      .is('referred_by_user_id', null);
    if (error) throw new BadRequestException('Could not apply that code.');
    await this.rewardReferrer(referrer.id, referrer.role);
    return { claimed: true };
  }

  private async rewardReferrer(referrerId: string, role: string | null) {
    const supabase = getSupabaseClient();
    const artistRoles = new Set([
      'artist',
      'dj',
      'musician',
      'service_provider',
      'admin',
    ]);
    if (artistRoles.has((role ?? '').toLowerCase())) {
      const { data: credits } = await supabase
        .from('credits')
        .select('welcome_placements_remaining')
        .eq('artist_id', referrerId)
        .maybeSingle();
      if (!credits) return;
      await supabase
        .from('credits')
        .update({
          welcome_placements_remaining:
            Number(credits.welcome_placements_remaining ?? 0) + 3,
        })
        .eq('artist_id', referrerId);
      return;
    }
    const { data: sub } = await supabase
      .from('pro_radio_subscriptions')
      .select('status')
      .eq('user_id', referrerId)
      .maybeSingle();
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) return;
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('pro_radio_subscriptions').upsert(
      {
        user_id: referrerId,
        status: 'trialing',
        store: 'app_store',
        current_period_end: end,
      },
      { onConflict: 'user_id' },
    );
  }

  async notificationPrefs(userId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select(
        'notifications_enabled, notify_new_follower, notify_feed_post_like, notify_messages, notify_live, notify_weekly_digest, quiet_hours_start, quiet_hours_end',
      )
      .eq('id', userId)
      .maybeSingle();
    return {
      notificationsEnabled: data?.notifications_enabled !== false,
      newFollower: data?.notify_new_follower !== false,
      feedLike: data?.notify_feed_post_like !== false,
      messages: data?.notify_messages !== false,
      live: data?.notify_live !== false,
      weeklyDigest: data?.notify_weekly_digest !== false,
      quietHoursStart: data?.quiet_hours_start ?? null,
      quietHoursEnd: data?.quiet_hours_end ?? null,
    };
  }

  async updateNotificationPrefs(userId: string, body: Record<string, unknown>) {
    const patch: Record<string, unknown> = {};
    const flags: Array<[string, string]> = [
      ['notificationsEnabled', 'notifications_enabled'],
      ['newFollower', 'notify_new_follower'],
      ['feedLike', 'notify_feed_post_like'],
      ['messages', 'notify_messages'],
      ['live', 'notify_live'],
      ['weeklyDigest', 'notify_weekly_digest'],
    ];
    for (const [from, to] of flags) {
      if (typeof body[from] === 'boolean') patch[to] = body[from];
    }
    for (const [from, to] of [
      ['quietHoursStart', 'quiet_hours_start'],
      ['quietHoursEnd', 'quiet_hours_end'],
    ] as const) {
      if (body[from] === null) patch[to] = null;
      if (typeof body[from] === 'number' && body[from] >= 0 && body[from] <= 23) {
        patch[to] = body[from];
      }
    }
    if (!Object.keys(patch).length) return this.notificationPrefs(userId);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').update(patch).eq('id', userId);
    if (error) throw new BadRequestException(error.message);
    return this.notificationPrefs(userId);
  }

  async recordListen(
    userId: string,
    body: { songId?: string; title?: string; artistName?: string; artworkUrl?: string },
  ) {
    const title = (body.title ?? '').trim();
    if (!title) return { saved: false };
    const supabase = getSupabaseClient();
    await supabase.from('listening_history').insert({
      user_id: userId,
      song_id: body.songId ?? null,
      title,
      artist_name: body.artistName ?? null,
      artwork_url: body.artworkUrl ?? null,
    });
    return { saved: true };
  }

  async listeningHistory(userId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('listening_history')
      .select('id, song_id, title, artist_name, artwork_url, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(50);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      songId: row.song_id,
      title: row.title,
      artistName: row.artist_name,
      artworkUrl: row.artwork_url,
      playedAt: row.played_at,
    }));
  }

  async favorites(userId: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('song_favorites')
      .select('song_id, created_at, songs(id, title, artist_name, artwork_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data ?? []).map((row: any) => ({
      songId: row.song_id,
      title: row.songs?.title ?? 'Song',
      artistName: row.songs?.artist_name ?? '',
      artworkUrl: row.songs?.artwork_url ?? null,
    }));
  }

  /** Monday afternoon UTC. Artists who opted in get a one-line week recap. */
  @Cron('0 16 * * 1')
  async sendWeeklyDigests() {
    const supabase = getSupabaseClient();
    const { data: artists, error } = await supabase
      .from('users')
      .select('id')
      .eq('notify_weekly_digest', true)
      .eq('notifications_enabled', true)
      .in('role', ['artist', 'dj', 'musician'])
      .limit(500);
    if (error || !artists?.length) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    for (const artist of artists) {
      try {
        const { data: songs } = await supabase
          .from('songs')
          .select('id')
          .eq('artist_id', artist.id)
          .limit(80);
        const ids = (songs ?? []).map((s: any) => s.id as string);
        let plays = 0;
        if (ids.length) {
          const { count } = await supabase
            .from('plays')
            .select('id', { count: 'exact', head: true })
            .in('song_id', ids)
            .gte('played_at', since);
          plays = count ?? 0;
        }
        await this.push.enqueue({
          userId: artist.id,
          title: 'Your week on NetworX',
          body:
            plays > 0
              ? `Your songs were played ${plays} time${plays === 1 ? '' : 's'} this week. Open Analytics for region and ROI.`
              : 'No new radio plays this week. Upload or boost a song to get back on a station.',
          data: { type: 'weekly_digest' },
        });
      } catch (err) {
        this.logger.warn(`Weekly digest skipped for ${artist.id}: ${err}`);
      }
    }
  }
}
