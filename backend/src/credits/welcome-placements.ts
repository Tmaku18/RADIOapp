import { getSupabaseClient } from '../config/supabase.config';

/** Discovery placements gifted to artists/producers at signup. */
export const SIGNUP_WELCOME_PLACEMENTS = 10;

/**
 * Must stay in sync with `EXPOSURES_PER_PLACEMENT` in payments.service.ts.
 * Each welcome placement converts to this many song.credits_remaining units.
 */
export const WELCOME_EXPOSURES_PER_PLACEMENT = 1000;

/**
 * Ensure a credits row exists and grant the one-time signup welcome placement
 * bonus if it has never been granted. Safe to call on every creative signup /
 * role upgrade — will not double-grant.
 */
export async function ensureWelcomePlacements(artistId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing } = await supabase
    .from('credits')
    .select('artist_id, welcome_bonus_granted_at, welcome_placements_remaining')
    .eq('artist_id', artistId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('credits').insert({
      artist_id: artistId,
      balance: 0,
      welcome_placements_remaining: SIGNUP_WELCOME_PLACEMENTS,
      welcome_bonus_granted_at: new Date().toISOString(),
    });
    if (error && error.code !== '23505') {
      console.error('Failed to create credits with welcome placements:', error);
    }
    return;
  }

  if (existing.welcome_bonus_granted_at) return;

  const { error } = await supabase
    .from('credits')
    .update({
      welcome_placements_remaining: SIGNUP_WELCOME_PLACEMENTS,
      welcome_bonus_granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('artist_id', artistId)
    .is('welcome_bonus_granted_at', null);
  if (error) {
    console.error('Failed to grant welcome placements:', error);
  }
}
