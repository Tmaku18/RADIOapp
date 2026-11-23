import type { SupabaseClient } from '@supabase/supabase-js';

export const MAKER_ROLE_ORDER = [
  'artist',
  'service_provider',
  'musician',
  'dj',
] as const;

export type MakerRole = (typeof MAKER_ROLE_ORDER)[number];

export type VoteStamp = {
  voter_cohort: 'popular' | 'peer' | null;
  counts_toward_score: boolean;
};

const BURST_WINDOW_MS = 60_000;
const BURST_LIMIT = 8;
const FLAG_COOLDOWN_MS = 60 * 60 * 1000;

export function normalizeMakerRoles(input: unknown): MakerRole[] {
  if (!Array.isArray(input)) return [];
  const picked = new Set(
    input.filter((role): role is MakerRole =>
      (MAKER_ROLE_ORDER as readonly string[]).includes(role),
    ),
  );
  return MAKER_ROLE_ORDER.filter((role) => picked.has(role));
}

/** Admin stays admin. Otherwise the first maker role, or listener. */
export function primaryRoleFromMakers(
  roles: readonly string[],
  existingRole?: string | null,
): 'admin' | MakerRole | 'listener' {
  if (existingRole === 'admin') return 'admin';
  for (const role of MAKER_ROLE_ORDER) {
    if (roles.includes(role)) return role;
  }
  return 'listener';
}

function isMissingRelation(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string } | null;
  const message = (maybe?.message ?? '').toLowerCase();
  return (
    maybe?.code === '42P01' ||
    maybe?.code === '42703' ||
    maybe?.code === 'PGRST204' ||
    maybe?.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
}

/** Record a suspicious account for admin review. Never bans. One flag per reason per hour. */
export async function flagActivity(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  detail?: string,
): Promise<void> {
  const since = new Date(Date.now() - FLAG_COOLDOWN_MS).toISOString();
  const existing = await supabase
    .from('activity_flags')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .gte('created_at', since)
    .limit(1);
  if (existing.error) {
    if (!isMissingRelation(existing.error)) {
      console.warn(`activity flag lookup failed: ${existing.error.message}`);
    }
    return;
  }
  if ((existing.data ?? []).length > 0) return;
  const payload: { user_id: string; reason: string; detail?: string } = {
    user_id: userId,
    reason,
  };
  if (detail) payload.detail = detail;
  let inserted = await supabase.from('activity_flags').insert(payload);
  if (
    inserted.error &&
    `${inserted.error.message ?? ''}`.toLowerCase().includes('detail')
  ) {
    inserted = await supabase
      .from('activity_flags')
      .insert({ user_id: userId, reason });
  }
  if (inserted.error && !isMissingRelation(inserted.error)) {
    console.warn(`activity flag insert failed: ${inserted.error.message}`);
  }
}

/**
 * True when this account already did `limit` of these actions in the last minute.
 * The caller should drop the new action. The account is flagged, not banned.
 */
export async function isActionFlood(
  supabase: SupabaseClient,
  args: {
    table: string;
    userId: string;
    userColumn?: string;
    timeColumn?: string;
    limit: number;
    reason: string;
    detail: string;
  },
): Promise<boolean> {
  const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
  const userColumn = args.userColumn ?? 'user_id';
  const timeColumn = args.timeColumn ?? 'created_at';
  const recent = await supabase
    .from(args.table)
    .select(userColumn, { count: 'exact', head: true })
    .eq(userColumn, args.userId)
    .gte(timeColumn, since);
  if (recent.error) return false;
  const count = recent.count ?? 0;
  if (count < args.limit) return false;
  await flagActivity(
    supabase,
    args.userId,
    args.reason,
    `${args.detail} (${count} in the last minute)`,
  );
  return true;
}

async function heardSong(
  supabase: SupabaseClient,
  userId: string,
  songId: string,
): Promise<boolean> {
  const session = await supabase
    .from('prospector_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .gt('heartbeat_count', 0)
    .limit(1);
  if (!session.error && (session.data ?? []).length > 0) return true;
  if (session.error && !isMissingRelation(session.error)) {
    // A lookup failure should not throw away a real vote.
    return true;
  }

  const profileListen = await supabase
    .from('song_profile_listens')
    .select('user_id')
    .eq('user_id', userId)
    .eq('song_id', songId)
    .limit(1);
  if (!profileListen.error && (profileListen.data ?? []).length > 0) return true;
  if (profileListen.error && !isMissingRelation(profileListen.error)) return true;
  if (session.error && profileListen.error) return true;
  return false;
}

async function isVoteBurst(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
  const likes = await supabase
    .from('leaderboard_likes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  const ratings = await supabase
    .from('song_listener_ratings')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('updated_at', since);
  if (likes.error && ratings.error) return 0;
  return (likes.count ?? 0) + (ratings.count ?? 0);
}

/**
 * Stamp a fire, pass, or rating with the voter's cohort at this moment.
 * Votes with no listen, and burst votes, are saved but left out of both scores.
 * Nothing here bans the account.
 */
export async function stampVote(
  supabase: SupabaseClient,
  userId: string,
  songId: string,
): Promise<VoteStamp> {
  let userRes = await supabase
    .from('users')
    .select('role, user_roles')
    .eq('id', userId)
    .maybeSingle();
  if (userRes.error && isMissingRelation(userRes.error)) {
    userRes = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
  }
  const role = (userRes.data?.role as string | undefined) ?? 'listener';
  const makers = normalizeMakerRoles(userRes.data?.user_roles);
  if (role !== 'listener' && role !== 'admin' && !makers.includes(role as MakerRole)) {
    const extra = normalizeMakerRoles([role]);
    makers.push(...extra.filter((item) => !makers.includes(item)));
  }
  const cohort: VoteStamp['voter_cohort'] =
    role === 'admin' ? null : makers.length > 0 ? 'peer' : 'popular';

  if (role === 'admin') {
    return { voter_cohort: null, counts_toward_score: false };
  }

  const heard = await heardSong(supabase, userId, songId);
  if (!heard) {
    await flagActivity(
      supabase,
      userId,
      'vote_without_listen',
      'Fire, pass, or rating with no listen on that song',
    );
    return { voter_cohort: cohort, counts_toward_score: false };
  }

  const burst = await isVoteBurst(supabase, userId);
  if (burst >= BURST_LIMIT) {
    await flagActivity(
      supabase,
      userId,
      'vote_burst',
      `${burst} fire, pass, or rating votes in the last minute`,
    );
    return { voter_cohort: cohort, counts_toward_score: false };
  }

  return { voter_cohort: cohort, counts_toward_score: true };
}

/** Same comment three times in a row is ignored and flagged. Never bans. */
export async function isRepeatedComment(
  supabase: SupabaseClient,
  userId: string,
  message: string,
): Promise<boolean> {
  const trimmed = message.trim();
  if (!trimmed) return false;
  const recent = await supabase
    .from('chat_messages')
    .select('message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(2);
  if (recent.error) return false;
  const rows = recent.data ?? [];
  const repeated =
    rows.length === 2 && rows.every((row) => row.message === trimmed);
  if (repeated) {
    await flagActivity(
      supabase,
      userId,
      'comment_repeat',
      'Same comment sent three times in a row',
    );
  }
  return repeated;
}
