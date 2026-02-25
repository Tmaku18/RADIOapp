import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { StripeService } from '../payments/stripe.service';

type CloudflareCreateInputResult = {
  uid: string;
  rtmps?: {
    url?: string;
    streamKey?: string;
  };
  webRTC?: {
    url?: string;
  };
};

@Injectable()
export class ArtistLiveService {
  private readonly logger = new Logger(ArtistLiveService.name);

  constructor(
    private readonly pushNotifications: PushNotificationService,
    private readonly stripeService: StripeService,
  ) {}

  private ensureLiveEnabled() {
    if ((process.env.ARTIST_LIVE_ENABLED || 'false').toLowerCase() !== 'true') {
      throw new BadRequestException('Artist livestream is currently disabled');
    }
  }

  private async getDbUser(firebaseUid: string): Promise<{
    id: string;
    role: string | null;
    is_banned?: boolean | null;
  }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, role, is_banned')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) {
      throw new UnauthorizedException('User not found');
    }
    return data;
  }

  private async cloudflareRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token =
      process.env.CLOUDFLARE_STREAM_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !token) {
      throw new BadRequestException('Cloudflare Stream env vars are missing');
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();
    if (!res.ok || json?.success === false) {
      const message =
        json?.errors?.[0]?.message ||
        `Cloudflare request failed (${res.status})`;
      throw new BadRequestException(message);
    }

    return json?.result as T;
  }

  private async ensureArtistProfile(userId: string) {
    const supabase = getSupabaseClient();
    const { data: existing, error } = await supabase
      .from('artist_live_profiles')
      .select('user_id, cloudflare_live_input_uid, is_live_banned')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw new BadRequestException(
        `Failed to load artist live profile: ${error.message}`,
      );
    }
    if (existing?.is_live_banned) {
      throw new ForbiddenException(
        'Artist is currently banned from livestreaming',
      );
    }
    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from('artist_live_profiles')
      .insert({ user_id: userId })
      .select('user_id, cloudflare_live_input_uid, is_live_banned')
      .single();
    if (createError || !created) {
      throw new BadRequestException(
        `Failed to create artist live profile: ${createError?.message}`,
      );
    }
    return created;
  }

  private async ensureCloudflareInput(userId: string): Promise<{
    inputUid: string;
    rtmpUrl: string | null;
    streamKey: string | null;
    watchUrl: string | null;
  }> {
    const supabase = getSupabaseClient();
    const profile = await this.ensureArtistProfile(userId);

    if (profile.cloudflare_live_input_uid) {
      const liveInputUid = profile.cloudflare_live_input_uid as string;
      return {
        inputUid: liveInputUid,
        rtmpUrl: 'rtmps://live.cloudflare.com:443/live/',
        streamKey: null,
        watchUrl: null,
      };
    }

    const created = await this.cloudflareRequest<CloudflareCreateInputResult>(
      'POST',
      '/stream/live_inputs',
      {
        meta: { name: `artist-${userId}` },
        recording: { mode: 'automatic' },
      },
    );

    const inputUid = created.uid;
    const rtmpUrl = created.rtmps?.url || null;
    const streamKey = created.rtmps?.streamKey || null;
    const watchUrl = created.webRTC?.url || null;

    const { error } = await supabase
      .from('artist_live_profiles')
      .update({ cloudflare_live_input_uid: inputUid })
      .eq('user_id', userId);
    if (error) {
      throw new BadRequestException(
        `Failed saving Cloudflare input UID: ${error.message}`,
      );
    }

    return { inputUid, rtmpUrl, streamKey, watchUrl };
  }

  private async getOnAirSongForArtist(
    artistId: string,
  ): Promise<{ songId: string; title: string } | null> {
    const supabase = getSupabaseClient();
    const { data: playRows } = await supabase
      .from('plays')
      .select(
        'song_id, played_at, songs!inner(id, title, artist_id, duration_seconds)',
      )
      .eq('songs.artist_id', artistId)
      .order('played_at', { ascending: false })
      .limit(1);

    const latest = (playRows ?? [])[0] as any;
    if (!latest) return null;
    const playedAtMs = new Date(latest.played_at).getTime();
    const durationSeconds = latest?.songs?.duration_seconds ?? 180;
    if (!Number.isFinite(playedAtMs)) return null;
    const stillOnAir = Date.now() < playedAtMs + durationSeconds * 1000;
    if (!stillOnAir) return null;

    return {
      songId: latest.song_id,
      title: latest?.songs?.title ?? 'Current track',
    };
  }

  async startLive(
    firebaseUid: string,
    payload: { title?: string; description?: string; category?: string },
  ) {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const dbUser = await this.getDbUser(firebaseUid);
    if (dbUser.is_banned) {
      throw new ForbiddenException('Account suspended');
    }
    if (dbUser.role !== 'artist' && dbUser.role !== 'admin') {
      throw new ForbiddenException('Only artists can go live');
    }

    const { data: active } = await supabase
      .from('artist_live_sessions')
      .select('id')
      .eq('artist_id', dbUser.id)
      .in('status', ['starting', 'live'])
      .maybeSingle();
    if (active) {
      throw new BadRequestException('You already have an active live session');
    }

    const cf = await this.ensureCloudflareInput(dbUser.id);

    const { data: session, error } = await supabase
      .from('artist_live_sessions')
      .insert({
        artist_id: dbUser.id,
        status: 'starting',
        provider: 'cloudflare',
        provider_input_uid: cf.inputUid,
        rtmp_url: cf.rtmpUrl,
        stream_key: cf.streamKey,
        title: payload.title || null,
        metadata: {
          description: payload.description || null,
          category: payload.category || null,
        },
      })
      .select(
        'id, artist_id, status, provider_input_uid, provider_video_uid, playback_hls_url, playback_dash_url, watch_url, title, created_at, started_at',
      )
      .single();
    if (error || !session) {
      throw new BadRequestException(
        `Failed to start live session: ${error?.message}`,
      );
    }

    const onAirSong = await this.getOnAirSongForArtist(dbUser.id);
    if (onAirSong) {
      try {
        const { data: artist } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', dbUser.id)
          .single();
        await this.pushNotifications.notifyActiveListenersArtistLive({
          artistId: dbUser.id,
          artistName: artist?.display_name || 'An artist',
          sessionId: session.id,
          songId: onAirSong.songId,
        });
      } catch (e) {
        this.logger.warn(
          `Failed to fanout artist live notifications: ${e?.message ?? e}`,
        );
      }
    }

    return {
      session,
      ingest: {
        inputUid: cf.inputUid,
        rtmpUrl: cf.rtmpUrl,
        streamKey: cf.streamKey,
      },
      featureFlags: {
        donationsEnabled:
          (process.env.STREAM_DONATIONS_ENABLED || 'false').toLowerCase() ===
          'true',
      },
    };
  }

  async stopLive(firebaseUid: string) {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const dbUser = await this.getDbUser(firebaseUid);
    const { data: active } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id, status')
      .eq('artist_id', dbUser.id)
      .in('status', ['starting', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!active) {
      throw new NotFoundException('No active stream to stop');
    }

    const endedAt = new Date().toISOString();
    const { error } = await supabase
      .from('artist_live_sessions')
      .update({
        status: 'ended',
        ended_at: endedAt,
        current_viewers: 0,
      })
      .eq('id', active.id);
    if (error) {
      throw new BadRequestException(`Failed to stop stream: ${error.message}`);
    }

    return { stopped: true, endedAt, sessionId: active.id };
  }

  async getArtistStatus(artistId: string) {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const { data: artist } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', artistId)
      .maybeSingle();
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    const { data: session } = await supabase
      .from('artist_live_sessions')
      .select(
        'id, status, title, provider_input_uid, provider_video_uid, playback_hls_url, playback_dash_url, watch_url, started_at, ended_at, current_viewers, peak_viewers, metadata',
      )
      .eq('artist_id', artistId)
      .in('status', ['starting', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      artist,
      live: !!session,
      session: session || null,
    };
  }

  async getWatchInfo(artistId: string) {
    const status = await this.getArtistStatus(artistId);
    if (!status.session) {
      return { live: false, session: null };
    }
    return {
      live: true,
      session: status.session,
      chatRoomId: `artist-live:${status.session.id}`,
    };
  }

  async joinSession(
    sessionId: string,
    source?: string,
    firebaseUid?: string,
  ): Promise<{
    joined: boolean;
    viewerId: string;
    viewers: { current: number; peak: number };
  }> {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();

    const { data: session, error: sessionError } = await supabase
      .from('artist_live_sessions')
      .select('id, status, current_viewers, peak_viewers')
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) {
      throw new NotFoundException('Live session not found');
    }
    if (!['starting', 'live'].includes(session.status)) {
      throw new BadRequestException('This session is not currently live');
    }

    let userId: string | null = null;
    if (firebaseUid) {
      const dbUser = await this.getDbUser(firebaseUid);
      userId = dbUser.id;
    }

    const { data: viewerRow, error: viewerError } = await supabase
      .from('artist_live_viewers')
      .insert({
        session_id: sessionId,
        user_id: userId,
        source: source || null,
      })
      .select('id')
      .single();
    if (viewerError || !viewerRow) {
      throw new BadRequestException(
        `Failed to join session: ${viewerError?.message}`,
      );
    }

    const nextCurrent = (session.current_viewers || 0) + 1;
    const nextPeak = Math.max(session.peak_viewers || 0, nextCurrent);
    const { error: updateErr } = await supabase
      .from('artist_live_sessions')
      .update({
        current_viewers: nextCurrent,
        peak_viewers: nextPeak,
      })
      .eq('id', sessionId);
    if (updateErr) {
      this.logger.warn(
        `Failed to update viewer counters for session ${sessionId}: ${updateErr.message}`,
      );
    }

    return {
      joined: true,
      viewerId: viewerRow.id,
      viewers: {
        current: nextCurrent,
        peak: nextPeak,
      },
    };
  }

  async processCloudflareWebhook(payload: {
    inputId?: string;
    eventType?: string;
    videoUid?: string;
    raw?: unknown;
  }) {
    this.ensureLiveEnabled();
    if (!payload.inputId || !payload.eventType) {
      throw new BadRequestException('Malformed webhook payload');
    }
    const supabase = getSupabaseClient();

    const { data: activeSession } = await supabase
      .from('artist_live_sessions')
      .select('id, status, metadata')
      .eq('provider_input_uid', payload.inputId)
      .in('status', ['starting', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!activeSession) {
      return { accepted: true, matched: false };
    }

    const nowIso = new Date().toISOString();
    if (payload.eventType === 'live_input.connected') {
      await supabase
        .from('artist_live_sessions')
        .update({
          status: 'live',
          started_at: nowIso,
          provider_video_uid: payload.videoUid || null,
          metadata: {
            ...(activeSession.metadata || {}),
            lastWebhook: payload.eventType,
            lastWebhookAt: nowIso,
          },
        })
        .eq('id', activeSession.id);
    } else if (payload.eventType === 'live_input.disconnected') {
      await supabase
        .from('artist_live_sessions')
        .update({
          status: 'ended',
          ended_at: nowIso,
          current_viewers: 0,
          metadata: {
            ...(activeSession.metadata || {}),
            lastWebhook: payload.eventType,
            lastWebhookAt: nowIso,
          },
        })
        .eq('id', activeSession.id);
    }

    return { accepted: true, matched: true, sessionId: activeSession.id };
  }

  async createDonationIntent(
    firebaseUid: string,
    sessionId: string,
    payload: { amountCents: number; message?: string },
  ) {
    if (
      (process.env.STREAM_DONATIONS_ENABLED || 'false').toLowerCase() !== 'true'
    ) {
      throw new BadRequestException('Stream donations are disabled');
    }
    const supabase = getSupabaseClient();
    const donor = await this.getDbUser(firebaseUid);
    const amountCents = Math.floor(payload.amountCents || 0);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      throw new BadRequestException('Minimum donation is $1.00');
    }
    if (amountCents > 25000) {
      throw new BadRequestException('Donation exceeds per-transaction limit');
    }

    const { data: session, error: sessionError } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id, status')
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) {
      throw new NotFoundException('Live session not found');
    }
    if (!['starting', 'live'].includes(session.status)) {
      throw new BadRequestException('Session is not accepting donations');
    }

    const { data: donationRow, error: donationError } = await supabase
      .from('stream_donations')
      .insert({
        session_id: session.id,
        artist_id: session.artist_id,
        donor_user_id: donor.id,
        amount_cents: amountCents,
        currency: 'usd',
        status: 'pending',
        message: payload.message?.trim() || null,
      })
      .select('id')
      .single();
    if (donationError || !donationRow) {
      throw new BadRequestException(
        `Failed to create donation request: ${donationError?.message}`,
      );
    }

    const intent = await this.stripeService.createPaymentIntent(amountCents, {
      kind: 'stream_donation',
      donationId: donationRow.id,
      sessionId: session.id,
      artistId: session.artist_id,
      donorId: donor.id,
    });

    await supabase
      .from('stream_donations')
      .update({
        stripe_payment_intent_id: intent.id,
      })
      .eq('id', donationRow.id);

    return {
      donationId: donationRow.id,
      clientSecret: intent.client_secret,
      amountCents,
      currency: 'usd',
    };
  }

  async adminForceStopSession(sessionId: string) {
    const supabase = getSupabaseClient();
    const endedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('artist_live_sessions')
      .update({
        status: 'ended',
        ended_at: endedAt,
        current_viewers: 0,
      })
      .eq('id', sessionId)
      .select('id, artist_id')
      .single();
    if (error || !data) {
      throw new NotFoundException('Session not found');
    }
    return {
      stopped: true,
      sessionId: data.id,
      artistId: data.artist_id,
      endedAt,
    };
  }

  async adminSetArtistLiveBan(artistId: string, banned: boolean) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('artist_live_profiles')
      .upsert(
        { user_id: artistId, is_live_banned: banned },
        { onConflict: 'user_id' },
      );
    if (error) {
      throw new BadRequestException(
        `Failed to update live ban: ${error.message}`,
      );
    }
    return { artistId, isLiveBanned: banned };
  }

  async reportStream(firebaseUid: string, sessionId: string, reason: string) {
    const supabase = getSupabaseClient();
    const reporter = await this.getDbUser(firebaseUid);
    const { error } = await supabase.from('notifications').insert({
      user_id: reporter.id,
      type: 'stream_report_submitted',
      title: 'Stream report submitted',
      message:
        'Thanks for helping keep NETWORX safe. Our moderators will review this stream.',
      metadata: {
        sessionId,
        reason,
      },
    });
    if (error) {
      throw new BadRequestException(
        `Failed to submit report: ${error.message}`,
      );
    }
    return { reported: true };
  }

  async trackAdImpression(sessionId: string, firebaseUid?: string) {
    if (
      (process.env.STREAM_ADS_TRACKING_ENABLED || 'false').toLowerCase() !==
      'true'
    ) {
      return { tracked: false, reason: 'disabled' };
    }
    const supabase = getSupabaseClient();
    let userId: string | null = null;
    if (firebaseUid) {
      try {
        userId = (await this.getDbUser(firebaseUid)).id;
      } catch {
        userId = null;
      }
    }

    const { error } = await supabase.from('stream_ad_impressions').insert({
      session_id: sessionId,
      user_id: userId,
    });
    if (error) {
      throw new BadRequestException(
        `Failed to track ad impression: ${error.message}`,
      );
    }
    return { tracked: true };
  }
}
