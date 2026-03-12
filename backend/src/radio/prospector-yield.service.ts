import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { randomUUID } from 'crypto';

type ProspectorTier = 'none' | 'copper' | 'silver' | 'gold' | 'diamond';

function computeTier(oresRefinedCount: number): ProspectorTier {
  if (oresRefinedCount >= 5000) return 'diamond';
  if (oresRefinedCount >= 1000) return 'gold';
  if (oresRefinedCount >= 250) return 'silver';
  if (oresRefinedCount >= 50) return 'copper';
  return 'none';
}

@Injectable()
export class ProspectorYieldService {
  private readonly logger = new Logger(ProspectorYieldService.name);

  private async getUserByFirebaseUid(
    firebaseUid: string,
  ): Promise<{ id: string; role: string }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error || !data) {
      throw new BadRequestException('User not found');
    }
    return { id: data.id, role: data.role };
  }

  private async ensureYieldRow(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('prospector_yield').upsert(
      {
        user_id: userId,
        balance_cents: 0,
        total_earned_cents: 0,
        total_redeemed_cents: 0,
        ores_refined_count: 0,
        tier: 'none',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      this.logger.warn(
        `Failed to ensure prospector_yield row: ${error.message}`,
      );
      throw new BadRequestException('Failed to initialize Yield');
    }
  }

  async getYield(firebaseUid: string): Promise<{
    balanceCents: number;
    tier: ProspectorTier;
    oresRefinedCount: number;
  }> {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener') {
      return { balanceCents: 0, tier: 'none', oresRefinedCount: 0 };
    }

    await this.ensureYieldRow(userId);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('prospector_yield')
      .select('balance_cents, tier, ores_refined_count')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new BadRequestException('Failed to load Yield');

    return {
      balanceCents: data.balance_cents ?? 0,
      tier: (data.tier ?? 'none') as ProspectorTier,
      oresRefinedCount: data.ores_refined_count ?? 0,
    };
  }

  async recordCheckIn(
    firebaseUid: string,
    sessionId?: string | null,
  ): Promise<{ checkedIn: true }> {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener') return { checkedIn: true };

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('prospector_check_ins').insert({
      user_id: userId,
      session_id: sessionId ?? null,
      checked_at: new Date().toISOString(),
    });

    if (error)
      throw new BadRequestException(
        `Failed to record check-in: ${error.message}`,
      );
    return { checkedIn: true };
  }

  private async isCheckInValid(
    userId: string,
    now: Date,
    minutes: number,
    sessionStartedAtIso?: string | null,
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('prospector_check_ins')
      .select('checked_at')
      .eq('user_id', userId)
      .order('checked_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.warn(`Failed to check check-ins: ${error.message}`);
      return false;
    }

    const latestCheckedAt = (data ?? [])[0]?.checked_at as string | undefined;
    const windowStartMs = now.getTime() - minutes * 60_000;

    if (!latestCheckedAt) {
      // Grace window: allow initial accrual for the first N minutes of a new session,
      // then require check-ins every N minutes after that.
      if (!sessionStartedAtIso) return false;
      return new Date(sessionStartedAtIso).getTime() >= windowStartMs;
    }

    return new Date(latestCheckedAt).getTime() >= windowStartMs;
  }

  async recordHeartbeat(
    firebaseUid: string,
    body: { songId: string; streamToken?: string; timestamp?: string },
  ): Promise<{
    received: true;
    ignored?: true;
    sessionId?: string;
    heartbeatCount?: number;
    accrualCents?: number;
    requiresCheckIn?: boolean;
    balanceCents?: number;
  }> {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener') return { received: true, ignored: true };
    if (!body.songId) throw new BadRequestException('songId is required');

    await this.ensureYieldRow(userId);
    const now = new Date();

    const supabase = getSupabaseClient();
    const { data: activeRows, error: activeError } = await supabase
      .from('prospector_sessions')
      .select('id, song_id, heartbeat_count, started_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    if (activeError)
      throw new BadRequestException(
        `Failed to load session: ${activeError.message}`,
      );

    const active = (activeRows ?? [])[0] as
      | {
          id: string;
          song_id: string;
          heartbeat_count: number;
          started_at: string;
        }
      | undefined;
    let sessionId: string;
    let nextHeartbeatCount: number;
    let sessionStartedAtIso: string | null = null;

    if (!active) {
      const { data: created, error } = await supabase
        .from('prospector_sessions')
        .insert({
          user_id: userId,
          song_id: body.songId,
          started_at: now.toISOString(),
          last_heartbeat_at: now.toISOString(),
          heartbeat_count: 1,
        })
        .select('id, heartbeat_count')
        .single();

      if (error || !created)
        throw new BadRequestException(
          `Failed to create session: ${error?.message || 'unknown'}`,
        );
      sessionId = created.id;
      nextHeartbeatCount = created.heartbeat_count ?? 1;
      sessionStartedAtIso = now.toISOString();
    } else if (active.song_id !== body.songId) {
      // End prior song session, start a new one for this ore.
      await supabase
        .from('prospector_sessions')
        .update({ ended_at: now.toISOString() })
        .eq('id', active.id);

      const { data: created, error } = await supabase
        .from('prospector_sessions')
        .insert({
          user_id: userId,
          song_id: body.songId,
          started_at: now.toISOString(),
          last_heartbeat_at: now.toISOString(),
          heartbeat_count: 1,
        })
        .select('id, heartbeat_count')
        .single();

      if (error || !created)
        throw new BadRequestException(
          `Failed to create session: ${error?.message || 'unknown'}`,
        );
      sessionId = created.id;
      nextHeartbeatCount = created.heartbeat_count ?? 1;
      sessionStartedAtIso = now.toISOString();
    } else {
      sessionId = active.id;
      nextHeartbeatCount = (active.heartbeat_count ?? 0) + 1;
      sessionStartedAtIso = active.started_at ?? null;
      const { error } = await supabase
        .from('prospector_sessions')
        .update({
          last_heartbeat_at: now.toISOString(),
          heartbeat_count: nextHeartbeatCount,
        })
        .eq('id', sessionId);
      if (error)
        throw new BadRequestException(
          `Failed to update session: ${error.message}`,
        );
    }

    const requiresCheckIn = !(await this.isCheckInValid(
      userId,
      now,
      20,
      sessionStartedAtIso,
    ));

    // Micro-accrual: 1 cent per verified minute (2 heartbeats @ 30s cadence).
    // We only accrue sync time if the Prospector has a recent check-in.
    let accrualCents = 0;
    if (!requiresCheckIn && nextHeartbeatCount % 2 === 0) {
      accrualCents = 1;

      const { data: yieldRow, error: yErr } = await supabase
        .from('prospector_yield')
        .select(
          'balance_cents, total_earned_cents, total_redeemed_cents, ores_refined_count, tier',
        )
        .eq('user_id', userId)
        .single();

      if (yErr || !yieldRow)
        throw new BadRequestException('Failed to update Yield');

      const newBalance = (yieldRow.balance_cents ?? 0) + accrualCents;
      const newTotalEarned = (yieldRow.total_earned_cents ?? 0) + accrualCents;

      const { error: upErr } = await supabase
        .from('prospector_yield')
        .update({
          balance_cents: newBalance,
          total_earned_cents: newTotalEarned,
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId);

      if (upErr)
        throw new BadRequestException(
          `Failed to accrue Yield: ${upErr.message}`,
        );

      return {
        received: true,
        sessionId,
        heartbeatCount: nextHeartbeatCount,
        accrualCents,
        requiresCheckIn,
        balanceCents: newBalance,
      };
    }

    return {
      received: true,
      sessionId,
      heartbeatCount: nextHeartbeatCount,
      accrualCents,
      requiresCheckIn,
    };
  }

  async submitRefinement(
    firebaseUid: string,
    body: { songId: string; playId?: string | null; score: number },
  ) {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener') return { refined: true, creditedCents: 0 };
    if (!body.songId) throw new BadRequestException('songId is required');
    if (!Number.isInteger(body.score) || body.score < 1 || body.score > 10)
      throw new BadRequestException('score must be 1-10');

    await this.ensureYieldRow(userId);
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('prospector_refinements')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', body.songId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('prospector_refinements')
        .update({
          score: body.score,
          updated_at: now,
          play_id: body.playId ?? null,
        })
        .eq('id', existing.id);
      if (error)
        throw new BadRequestException(
          `Failed to update refinement: ${error.message}`,
        );
      return { refined: true, creditedCents: 0, updated: true };
    }

    const { error: insErr } = await supabase
      .from('prospector_refinements')
      .insert({
        user_id: userId,
        song_id: body.songId,
        play_id: body.playId ?? null,
        score: body.score,
        created_at: now,
        updated_at: now,
      });
    if (insErr)
      throw new BadRequestException(
        `Failed to record refinement: ${insErr.message}`,
      );

    const creditedCents = body.score * 5; // 0.05 per score point

    const { data: yieldRow, error: yErr } = await supabase
      .from('prospector_yield')
      .select(
        'balance_cents, total_earned_cents, ores_refined_count, total_redeemed_cents',
      )
      .eq('user_id', userId)
      .single();
    if (yErr || !yieldRow)
      throw new BadRequestException('Failed to update Yield');

    const oresRefinedCount = (yieldRow.ores_refined_count ?? 0) + 1;
    const tier = computeTier(oresRefinedCount);

    const { error: upErr } = await supabase
      .from('prospector_yield')
      .update({
        balance_cents: (yieldRow.balance_cents ?? 0) + creditedCents,
        total_earned_cents: (yieldRow.total_earned_cents ?? 0) + creditedCents,
        ores_refined_count: oresRefinedCount,
        tier,
        updated_at: now,
      })
      .eq('user_id', userId);
    if (upErr)
      throw new BadRequestException(`Failed to credit Yield: ${upErr.message}`);

    return { refined: true, creditedCents, tier, oresRefinedCount };
  }

  async submitSurvey(
    firebaseUid: string,
    body: {
      songId: string;
      playId?: string | null;
      responses: Record<string, unknown>;
    },
  ) {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener') return { submitted: true, creditedCents: 0 };
    if (!body.songId) throw new BadRequestException('songId is required');
    if (!body.responses || typeof body.responses !== 'object')
      throw new BadRequestException('responses is required');

    await this.ensureYieldRow(userId);
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('prospector_surveys')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', body.songId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('prospector_surveys')
        .update({
          responses: body.responses,
          updated_at: now,
          play_id: body.playId ?? null,
        })
        .eq('id', existing.id);
      if (error)
        throw new BadRequestException(
          `Failed to update survey: ${error.message}`,
        );
      return { submitted: true, creditedCents: 0, updated: true };
    }

    const { error: insErr } = await supabase.from('prospector_surveys').insert({
      user_id: userId,
      song_id: body.songId,
      play_id: body.playId ?? null,
      responses: body.responses,
      created_at: now,
      updated_at: now,
    });
    if (insErr)
      throw new BadRequestException(
        `Failed to record survey: ${insErr.message}`,
      );

    const creditedCents = 25; // 0.25 survey completion

    const { data: yieldRow, error: yErr } = await supabase
      .from('prospector_yield')
      .select('balance_cents, total_earned_cents')
      .eq('user_id', userId)
      .single();
    if (yErr || !yieldRow)
      throw new BadRequestException('Failed to update Yield');

    const { error: upErr } = await supabase
      .from('prospector_yield')
      .update({
        balance_cents: (yieldRow.balance_cents ?? 0) + creditedCents,
        total_earned_cents: (yieldRow.total_earned_cents ?? 0) + creditedCents,
        updated_at: now,
      })
      .eq('user_id', userId);
    if (upErr)
      throw new BadRequestException(`Failed to credit Yield: ${upErr.message}`);

    return { submitted: true, creditedCents };
  }

  async redeem(
    firebaseUid: string,
    body: {
      amountCents: number;
      type: 'virtual_visa' | 'merch' | 'boost_credits';
      requestId?: string | null;
    },
  ) {
    const { id: userId, role } = await this.getUserByFirebaseUid(firebaseUid);
    if (role !== 'listener')
      throw new BadRequestException('Only Prospectors can redeem Yield');

    const amount = body.amountCents;
    if (!Number.isInteger(amount) || amount <= 0)
      throw new BadRequestException('amountCents must be a positive integer');
    if (body.type === 'virtual_visa') {
      if (amount !== 500 && amount !== 1000 && amount !== 2500) {
        throw new BadRequestException(
          'amountCents must be 500 ($5), 1000 ($10), or 2500 ($25) for Virtual Visa',
        );
      }
    } else {
      if (amount !== 1000 && amount !== 2500)
        throw new BadRequestException(
          'amountCents must be 1000 ($10) or 2500 ($25)',
        );
    }
    const now = new Date().toISOString();

    await this.ensureYieldRow(userId);
    const supabase = getSupabaseClient();

    const requestId = (body.requestId ?? '').trim() || randomUUID();
    const { data, error } = await supabase.rpc('redeem_prospector_yield', {
      p_user_id: userId,
      p_amount_cents: amount,
      p_type: body.type,
      p_request_id: requestId,
    });

    if (error) {
      const msg = error.message || 'Redemption failed';
      if (msg.toLowerCase().includes('already pending')) {
        throw new BadRequestException(
          'A redemption is already pending. Please wait for admin review.',
        );
      }
      if (msg.toLowerCase().includes('function redeem_prospector_yield')) {
        throw new BadRequestException(
          'Yield redemption is unavailable until the latest database migration is applied.',
        );
      }
      throw new BadRequestException(`Redemption failed: ${msg}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      redeemed: true,
      redemptionId: row?.redemption_id ?? row?.redemptionId ?? null,
      newBalanceCents: row?.new_balance_cents ?? row?.newBalanceCents ?? null,
      requestId,
    };
  }
}
