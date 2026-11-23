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

async function flagOnce(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
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
  const inserted = await supabase
    .from('activity_flags')
    .insert({ user_id: userId, reason });
  if (inserted.error && !isMissingRelation(inserted.error)) {
    console.warn(`activity flag insert failed: ${inserted.error.message}`);
  }
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
): Promise<boolean> {
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
  if (likes.error && ratings.error) return false;
  const total = (likes.count ?? 0) + (ratings.count ?? 0);
  return total >= BURST_LIMIT;
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
    await flagOnce(supabase, userId, 'vote_without_listen');
    return { voter_cohort: cohort, counts_toward_score: false };
  }

  const burst = await isVoteBurst(supabase, userId);
  if (burst) {
    await flagOnce(supabase, userId, 'vote_burst');
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
    await flagOnce(supabase, userId, 'comment_repeat');
  }
  return repeated;
}
