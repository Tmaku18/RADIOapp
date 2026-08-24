import { getSupabaseClient } from '../config/supabase.config';
import { ensureWelcomePlacements } from '../credits/welcome-placements';

const ALREADY_CREATOR = new Set([
  'artist',
  'service_provider',
  'admin',
  'dj',
  'musician',
]);

/**
 * Promote a listener to artist in place. No-op for creator/admin roles.
 * Used when a listener uploads a song or saves a Pro-Networx profile so they
 * don't have to visit Settings first.
 */
export async function promoteListenerToArtist(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !user) return;
  if (ALREADY_CREATOR.has(user.role)) return;
  if (user.role !== 'listener') return;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      role: 'artist',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (updateError) {
    throw new Error(`Failed to upgrade listener: ${updateError.message}`);
  }

  await ensureWelcomePlacements(userId);
}
