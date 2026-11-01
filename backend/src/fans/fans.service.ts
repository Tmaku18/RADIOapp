import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { EmailService } from '../email/email.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeFanEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

@Injectable()
export class FansService {
  constructor(private readonly email: EmailService) {}

  async subscribe(artistId: string, rawEmail: string) {
    const email = normalizeFanEmail(rawEmail);
    if (!email) {
      return { subscribed: false, reason: 'invalid_email' as const };
    }
    const supabase = getSupabaseClient();
    const { data: artist } = await supabase
      .from('users')
      .select('id, display_name, is_banned')
      .eq('id', artistId)
      .maybeSingle();
    if (!artist?.id || artist.is_banned) {
      throw new NotFoundException('Artist not found');
    }

    const { error } = await supabase.from('artist_fans').insert({
      artist_id: artistId,
      email,
    });
    const already = error?.code === '23505';
    if (error && !already) {
      throw error;
    }
    if (!already) {
      const name = (artist.display_name ?? 'this artist').toString();
      void this.email.send({
        to: email,
        subject: `You're on ${name}'s list`,
        text: `You're on ${name}'s email list at NetworX. They can write to you about new music. Ask them if you want to be removed.`,
      });
    }
    return { subscribed: true, already };
  }

  async listForArtist(artistUserId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('artist_fans')
      .select('id, email, created_at')
      .eq('artist_id', artistUserId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return {
      fans: (data ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        createdAt: row.created_at as string,
      })),
    };
  }

  async remove(artistUserId: string, fanId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('artist_fans')
      .delete()
      .eq('id', fanId)
      .eq('artist_id', artistUserId)
      .select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new NotFoundException('Fan not found');
    }
    return { removed: true };
  }
}
