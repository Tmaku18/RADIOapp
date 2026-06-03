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

  /**
   * Build Cloudflare Stream playback URLs from a live-input (or video) UID.
   * Cloudflare's customer subdomain code is required; if it's not configured we
   * return nulls and callers fall back to the iframe/initializing state.
   * HLS format: https://customer-<CODE>.cloudflarestream.com/<UID>/manifest/video.m3u8
   */
  private buildPlaybackUrls(uid?: string | null): {
    hlsUrl: string | null;
    dashUrl: string | null;
    watchUrl: string | null;
  } {
    const code = (
      process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ||
      process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN ||
      ''
    ).trim();
    if (!uid || !code) {
      return { hlsUrl: null, dashUrl: null, watchUrl: null };
    }
    const base = `https://customer-${code}.cloudflarestream.com/${uid}`;
    return {
      hlsUrl: `${base}/manifest/video.m3u8`,
      dashUrl: `${base}/manifest/video.mpd`,
      watchUrl: `${base}/iframe`,
    };
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
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

    // DELETE (and some other responses) can return an empty body; tolerate it.
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok || json?.success === false) {
      const message =
        json?.errors?.[0]?.message ||
        `Cloudflare request failed (${res.status})`;
      throw new BadRequestException(message);
    }

    return json?.result as T;
  }

  /**
   * Hard-disconnect a broadcaster by deleting their Cloudflare live input and
   * clearing the stored UID so the next go-live provisions a fresh input. This
   * severs any in-progress RTMP/WHIP push. Failures are logged but non-fatal so
   * the DB-level stop always succeeds.
   */
  private async cutCloudflareIngest(
    artistId: string,
    inputUid?: string | null,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    let uid = inputUid ?? null;
    if (!uid) {
      const { data: profile } = await supabase
        .from('artist_live_profiles')
        .select('cloudflare_live_input_uid')
        .eq('user_id', artistId)
        .maybeSingle();
      uid = (profile?.cloudflare_live_input_uid as string | undefined) ?? null;
    }
    if (!uid) return;
    try {
      await this.cloudflareRequest('DELETE', `/stream/live_inputs/${uid}`);
    } catch (e) {
      this.logger.warn(
        `Failed to delete Cloudflare input ${uid}: ${(e as Error)?.message ?? e}`,
      );
    }
    await supabase
      .from('artist_live_profiles')
      .update({ cloudflare_live_input_uid: null })
      .eq('user_id', artistId);
  }

  private async ensureArtistProfile(userId: string) {
    const supabase = getSupabaseClient();
    const { data: existing, error } = await supabase
      .from('artist_live_profiles')
      .select(
        'user_id, cloudflare_live_input_uid, is_live_banned, streaming_approved_at',
      )
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
      .select(
        'user_id, cloudflare_live_input_uid, is_live_banned, streaming_approved_at',
      )
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
    webRtcUrl: string | null;
    watchUrl: string | null;
  }> {
    const supabase = getSupabaseClient();
    const profile = await this.ensureArtistProfile(userId);

    if (profile.cloudflare_live_input_uid) {
      const liveInputUid = profile.cloudflare_live_input_uid as string;
      // Fetch the current ingest details so the broadcaster gets a fresh RTMP
      // key and the WebRTC/WHIP publish URL (for in-app camera broadcasting).
      try {
        const details =
          await this.cloudflareRequest<CloudflareCreateInputResult>(
            'GET',
            `/stream/live_inputs/${liveInputUid}`,
          );
        return {
          inputUid: liveInputUid,
          rtmpUrl: details.rtmps?.url || 'rtmps://live.cloudflare.com:443/live/',
          streamKey: details.rtmps?.streamKey || null,
          webRtcUrl: details.webRTC?.url || null,
          watchUrl: null,
        };
      } catch (e) {
        this.logger.warn(
          `Failed to fetch Cloudflare input ${liveInputUid}: ${
            (e as Error)?.message ?? e
          }`,
        );
        return {
          inputUid: liveInputUid,
          rtmpUrl: 'rtmps://live.cloudflare.com:443/live/',
          streamKey: null,
          webRtcUrl: null,
          watchUrl: null,
        };
      }
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
    const webRtcUrl = created.webRTC?.url || null;
    // The webRTC URL is a publish endpoint, not a viewer URL — viewer playback
    // URLs are derived from buildPlaybackUrls(). Don't expose it as watchUrl.
    const watchUrl = null;

    const { error } = await supabase
      .from('artist_live_profiles')
      .update({ cloudflare_live_input_uid: inputUid })
      .eq('user_id', userId);
    if (error) {
      throw new BadRequestException(
        `Failed saving Cloudflare input UID: ${error.message}`,
      );
    }

    return { inputUid, rtmpUrl, streamKey, webRtcUrl, watchUrl };
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
    payload: {
      title?: string;
      description?: string;
      category?: string;
      hostType?: 'dj' | 'artist' | 'musician';
    },
  ) {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const dbUser = await this.getDbUser(firebaseUid);
    if (dbUser.is_banned) {
      throw new ForbiddenException('Account suspended');
    }
    if (
      dbUser.role !== 'artist' &&
      dbUser.role !== 'admin' &&
      dbUser.role !== 'service_provider' &&
      dbUser.role !== 'dj' &&
      dbUser.role !== 'musician'
    ) {
      throw new ForbiddenException(
        'Only artists, Catalysts, DJs, or musicians can go live',
      );
    }
    // Live Performances are gated: only approved musicians (or admins) may
    // broadcast as a musician.
    if (
      payload.hostType === 'musician' &&
      dbUser.role !== 'musician' &&
      dbUser.role !== 'admin'
    ) {
      throw new ForbiddenException(
        'Live Performances require musician approval. Ask an admin to grant you the musician role.',
      );
    }
    // Admins and musicians can always go live (the musician role is itself the
    // approval to host Live Performances); everyone else needs streaming
    // approval. The live-ban check still applies to non-admins.
    if (dbUser.role !== 'admin') {
      const { data: profile } = await supabase
        .from('artist_live_profiles')
        .select('streaming_approved_at, is_live_banned')
        .eq('user_id', dbUser.id)
        .maybeSingle();
      if (profile?.is_live_banned) {
        throw new ForbiddenException(
          'You are currently banned from livestreaming',
        );
      }
      if (dbUser.role !== 'musician' && !profile?.streaming_approved_at) {
        throw new ForbiddenException(
          'Streaming access requires admin approval. Request access from your profile or Stream settings.',
        );
      }
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
    const playback = this.buildPlaybackUrls(cf.inputUid);
    // Honor explicit host intent (e.g. launched from "Go live as DJ" or
    // "Go live as musician"), falling back to the account role so a `dj` or
    // `musician` user always gets the right kind of session.
    let hostType: 'dj' | 'artist' | 'musician';
    if (payload.hostType === 'musician' || dbUser.role === 'musician') {
      hostType = 'musician';
    } else if (payload.hostType === 'dj' || dbUser.role === 'dj') {
      hostType = 'dj';
    } else {
      hostType = 'artist';
    }

    const { data: session, error } = await supabase
      .from('artist_live_sessions')
      .insert({
        artist_id: dbUser.id,
        status: 'starting',
        provider: 'cloudflare',
        provider_input_uid: cf.inputUid,
        rtmp_url: cf.rtmpUrl,
        stream_key: cf.streamKey,
        playback_hls_url: playback.hlsUrl,
        playback_dash_url: playback.dashUrl,
        watch_url: playback.watchUrl || cf.watchUrl,
        title: payload.title || null,
        metadata: {
          description: payload.description || null,
          category: payload.category || null,
          hostType,
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
        webRtcUrl: cf.webRtcUrl,
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

  /** Current user's streamer application/approval status. */
  async getStreamerStatus(firebaseUid: string): Promise<{
    canStream: boolean;
    appliedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    role: string;
  }> {
    const dbUser = await this.getDbUser(firebaseUid);
    const supabase = getSupabaseClient();
    const { data: profile } = await supabase
      .from('artist_live_profiles')
      .select(
        'streaming_applied_at, streaming_approved_at, streaming_rejected_at',
      )
      .eq('user_id', dbUser.id)
      .maybeSingle();

    const isAdmin = dbUser.role === 'admin';
    const canStream =
      isAdmin ||
      (!!profile?.streaming_approved_at && !profile?.streaming_rejected_at);

    return {
      canStream: !!canStream,
      appliedAt: profile?.streaming_applied_at ?? null,
      approvedAt: profile?.streaming_approved_at ?? null,
      rejectedAt: profile?.streaming_rejected_at ?? null,
      role: dbUser.role ?? 'listener',
    };
  }

  /** Apply to become a streamer (artist or Catalyst). Admin must approve. */
  async applyToStream(firebaseUid: string) {
    const dbUser = await this.getDbUser(firebaseUid);
    if (
      dbUser.role !== 'artist' &&
      dbUser.role !== 'service_provider' &&
      dbUser.role !== 'dj' &&
      dbUser.role !== 'musician'
    ) {
      throw new ForbiddenException(
        'Only artists, Catalysts, DJs, or musicians can apply to stream',
      );
    }
    const supabase = getSupabaseClient();
    await this.ensureArtistProfile(dbUser.id);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('artist_live_profiles')
      .update({
        streaming_applied_at: now,
        streaming_rejected_at: null,
      })
      .eq('user_id', dbUser.id);
    if (error) {
      throw new BadRequestException(
        `Failed to submit streamer application: ${error.message}`,
      );
    }
    return {
      applied: true,
      appliedAt: now,
      message: 'Your request has been submitted. An admin will review it.',
    };
  }

  async listLiveSessions(): Promise<{
    sessions: Array<{
      sessionId: string;
      artistId: string;
      displayName: string;
      avatarUrl: string | null;
      title: string | null;
      currentViewers: number;
      peakViewers: number;
      startedAt: string;
      status: string;
      hostRole: string;
    }>;
  }> {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const { data: rows, error } = await supabase
      .from('artist_live_sessions')
      .select(
        'id, artist_id, title, current_viewers, peak_viewers, started_at, status, metadata',
      )
      .in('status', ['starting', 'live'])
      .order('started_at', { ascending: false });
    if (error || !rows?.length) {
      return { sessions: [] };
    }
    const artistIds = [
      ...new Set(rows.map((r: { artist_id: string }) => r.artist_id)),
    ];
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, role')
      .in('id', artistIds);
    const userMap = new Map(
      (users || []).map(
        (u: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          role?: string | null;
        }) => [u.id, u],
      ),
    );
    // Compute true concurrent viewers per session from presence rows.
    const liveCounts = new Map<string, number>();
    await Promise.all(
      (rows as Array<{ id: string; artist_id: string }>).map(async (r) => {
        liveCounts.set(r.id, await this.countLiveViewers(r.id, r.artist_id));
      }),
    );
    const sessions = rows.map(
      (r: {
        id: string;
        artist_id: string;
        title?: string | null;
        current_viewers?: number;
        peak_viewers?: number;
        started_at?: string;
        status?: string;
        metadata?: { hostType?: string } | null;
      }) => {
        const u = userMap.get(r.artist_id);
        // Prefer the snapshot taken when the session started (metadata.hostType)
        // so a DJ/musician session keeps its kind, then fall back to the host's
        // current role.
        let hostRole: string;
        if (r.metadata?.hostType === 'musician' || u?.role === 'musician') {
          hostRole = 'musician';
        } else if (r.metadata?.hostType === 'dj' || u?.role === 'dj') {
          hostRole = 'dj';
        } else {
          hostRole = u?.role ?? 'artist';
        }
        return {
          sessionId: r.id,
          artistId: r.artist_id,
          displayName: u?.display_name ?? 'Artist',
          avatarUrl: u?.avatar_url ?? null,
          title: r.title ?? null,
          currentViewers: liveCounts.get(r.id) ?? 0,
          peakViewers: r.peak_viewers ?? 0,
          startedAt: r.started_at ?? new Date().toISOString(),
          status: r.status ?? 'live',
          hostRole,
        };
      },
    );
    return { sessions };
  }

  async getArtistStatus(artistId: string) {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const { data: artist } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, role')
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

    // Backfill playback URLs at read-time when they weren't persisted (e.g.
    // sessions created before HLS support, or when only the video UID is known).
    if (session && !session.playback_hls_url) {
      const playback = this.buildPlaybackUrls(
        session.provider_video_uid || session.provider_input_uid,
      );
      if (playback.hlsUrl) {
        session.playback_hls_url = playback.hlsUrl;
        session.playback_dash_url =
          session.playback_dash_url || playback.dashUrl;
        session.watch_url = session.watch_url || playback.watchUrl;
      }
    }

    // Reflect true concurrent viewers (presence-based) rather than the cached
    // counter, so the watch page shows an accurate "N watching".
    if (session) {
      session.current_viewers = await this.countLiveViewers(
        session.id,
        artistId,
      );
    }

    let hostRole: string;
    if (session?.metadata?.hostType === 'musician' || artist.role === 'musician') {
      hostRole = 'musician';
    } else if (session?.metadata?.hostType === 'dj' || artist.role === 'dj') {
      hostRole = 'dj';
    } else {
      hostRole = artist.role ?? 'artist';
    }

    return {
      artist,
      live: !!session,
      session: session || null,
      hostRole,
    };
  }

  async getWatchInfo(artistId: string) {
    const status = await this.getArtistStatus(artistId);
    if (!status.session) {
      return { live: false, session: null, hostRole: status.hostRole };
    }
    return {
      live: true,
      session: status.session,
      hostRole: status.hostRole,
      artist: status.artist,
      chatRoomId: `artist-live:${status.session.id}`,
    };
  }

  // A viewer is "present" if they haven't left and we've heard a heartbeat
  // within this window. Clients beat every ~15s; 45s tolerates a missed beat.
  private static readonly VIEWER_PRESENCE_WINDOW_MS = 45_000;

  /**
   * Count distinct concurrent viewers for a session from presence rows, not a
   * cumulative join counter. The host's own views (authenticated as the artist)
   * are excluded; refreshes/reconnects dedupe by user id, else by viewer token.
   */
  private async countLiveViewers(
    sessionId: string,
    artistId: string,
  ): Promise<number> {
    const supabase = getSupabaseClient();
    const cutoff = new Date(
      Date.now() - ArtistLiveService.VIEWER_PRESENCE_WINDOW_MS,
    ).toISOString();
    const { data } = await supabase
      .from('artist_live_viewers')
      .select('id, user_id, join_token')
      .eq('session_id', sessionId)
      .is('left_at', null)
      .gte('last_seen_at', cutoff);
    if (!data?.length) return 0;
    const keys = new Set<string>();
    for (const row of data as Array<{
      id: string;
      user_id: string | null;
      join_token: string | null;
    }>) {
      if (row.user_id && row.user_id === artistId) continue; // exclude host
      keys.add(row.user_id || row.join_token || row.id);
    }
    return keys.size;
  }

  /** Persist the freshly-computed concurrent count (and bump peak). */
  private async syncViewerCounters(
    sessionId: string,
    artistId: string,
    knownPeak?: number,
  ): Promise<number> {
    const supabase = getSupabaseClient();
    const current = await this.countLiveViewers(sessionId, artistId);
    const update: Record<string, unknown> = { current_viewers: current };
    if (knownPeak !== undefined && current > knownPeak) {
      update.peak_viewers = current;
    }
    await supabase
      .from('artist_live_sessions')
      .update(update)
      .eq('id', sessionId);
    return current;
  }

  async joinSession(
    sessionId: string,
    source?: string,
    firebaseUid?: string,
    viewerToken?: string,
  ): Promise<{
    joined: boolean;
    viewerId: string;
    viewers: { current: number; peak: number };
  }> {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();

    const { data: session, error: sessionError } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id, status, peak_viewers')
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
        join_token: viewerToken || null,
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (viewerError || !viewerRow) {
      throw new BadRequestException(
        `Failed to join session: ${viewerError?.message}`,
      );
    }

    const current = await this.syncViewerCounters(
      sessionId,
      session.artist_id,
      session.peak_viewers || 0,
    );

    return {
      joined: true,
      viewerId: viewerRow.id,
      viewers: {
        current,
        peak: Math.max(session.peak_viewers || 0, current),
      },
    };
  }

  /** Keep a viewer "present" — called periodically by watch clients. */
  async heartbeat(
    sessionId: string,
    viewerId: string,
  ): Promise<{ viewers: number }> {
    this.ensureLiveEnabled();
    const supabase = getSupabaseClient();
    const { data: session } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id, status')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) {
      throw new NotFoundException('Live session not found');
    }
    if (viewerId) {
      await supabase
        .from('artist_live_viewers')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', viewerId)
        .eq('session_id', sessionId)
        .is('left_at', null);
    }
    const current = await this.syncViewerCounters(sessionId, session.artist_id);
    return { viewers: current };
  }

  /** Mark a viewer as gone — called on unmount / page close. */
  async leaveSession(
    sessionId: string,
    viewerId: string,
  ): Promise<{ left: boolean; viewers: number }> {
    const supabase = getSupabaseClient();
    const { data: session } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) {
      return { left: false, viewers: 0 };
    }
    if (viewerId) {
      await supabase
        .from('artist_live_viewers')
        .update({ left_at: new Date().toISOString() })
        .eq('id', viewerId)
        .eq('session_id', sessionId);
    }
    const current = await this.syncViewerCounters(sessionId, session.artist_id);
    return { left: true, viewers: current };
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
      .select('id, status, metadata, playback_hls_url')
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
      // Prefer live-input UID for the manifest (stable across reconnects);
      // only set if not already persisted at session start.
      const playback = activeSession.playback_hls_url
        ? null
        : this.buildPlaybackUrls(payload.inputId);
      await supabase
        .from('artist_live_sessions')
        .update({
          status: 'live',
          started_at: nowIso,
          provider_video_uid: payload.videoUid || null,
          ...(playback?.hlsUrl
            ? {
                playback_hls_url: playback.hlsUrl,
                playback_dash_url: playback.dashUrl,
                watch_url: playback.watchUrl,
              }
            : {}),
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

  /**
   * Web donation flow: create a pending donation and a Stripe Checkout session,
   * then return the hosted-checkout URL to redirect to. The payments webhook
   * marks the donation succeeded on checkout.session.completed.
   */
  async createDonationCheckout(
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

    const { data: artist } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', session.artist_id)
      .maybeSingle();
    const artistName = artist?.display_name || 'this stream';

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

    const webUrl = process.env.WEB_URL || 'http://localhost:3001';
    const checkout = await this.stripeService.createCheckoutSessionSongPlays(
      amountCents,
      `Donation to ${artistName}`,
      `$${(amountCents / 100).toFixed(2)} tip for the live stream`,
      {
        kind: 'stream_donation',
        donationId: donationRow.id,
        sessionId: session.id,
        artistId: session.artist_id,
        donorId: donor.id,
      },
      `${webUrl}/watch/${session.artist_id}?donation=success`,
      `${webUrl}/watch/${session.artist_id}?donation=canceled`,
    );

    await supabase
      .from('stream_donations')
      .update({ stripe_checkout_session_id: checkout.id })
      .eq('id', donationRow.id);

    return {
      donationId: donationRow.id,
      url: checkout.url,
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
      .select('id, artist_id, provider_input_uid')
      .single();
    if (error || !data) {
      throw new NotFoundException('Session not found');
    }
    // Cut the broadcaster off at Cloudflare too so they can't keep pushing.
    await this.cutCloudflareIngest(data.artist_id, data.provider_input_uid);
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

  // ---------------------------------------------------------------------------
  // Live chat (Twitch-style)
  // ---------------------------------------------------------------------------

  private mapChatRow(row: {
    id: string;
    user_id: string | null;
    display_name: string;
    avatar_url: string | null;
    message: string;
    is_host: boolean;
    created_at: string;
  }) {
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      message: row.message,
      isHost: row.is_host === true,
      createdAt: row.created_at,
    };
  }

  /** Recent chat messages for a session. `after` = ISO timestamp for polling. */
  async listChatMessages(
    sessionId: string,
    options?: { after?: string; limit?: number },
  ) {
    const supabase = getSupabaseClient();
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    let query = supabase
      .from('stream_chat_messages')
      .select(
        'id, user_id, display_name, avatar_url, message, is_host, created_at',
      )
      .eq('session_id', sessionId)
      .eq('is_deleted', false);

    if (options?.after) {
      query = query.gt('created_at', options.after);
      query = query.order('created_at', { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) {
        throw new BadRequestException(
          `Failed to load chat: ${error.message}`,
        );
      }
      return { messages: (data || []).map((r) => this.mapChatRow(r)) };
    }

    // Initial load: newest `limit`, returned oldest→newest for display.
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new BadRequestException(`Failed to load chat: ${error.message}`);
    }
    const rows = (data || []).map((r) => this.mapChatRow(r)).reverse();
    return { messages: rows };
  }

  /** Post a chat message to a live session (must be signed in, session live). */
  async postChatMessage(
    firebaseUid: string,
    sessionId: string,
    rawMessage: string,
  ) {
    const supabase = getSupabaseClient();
    const text = (rawMessage || '').trim();
    if (!text) {
      throw new BadRequestException('Message cannot be empty');
    }
    if (text.length > 500) {
      throw new BadRequestException('Message is too long (max 500 characters)');
    }

    const sender = await this.getDbUser(firebaseUid);
    if (sender.is_banned) {
      throw new ForbiddenException('You are not allowed to chat');
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
      throw new BadRequestException('Chat is closed for this session');
    }

    const { data: profile } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', sender.id)
      .maybeSingle();

    const { data: inserted, error: insertError } = await supabase
      .from('stream_chat_messages')
      .insert({
        session_id: session.id,
        user_id: sender.id,
        display_name: profile?.display_name || 'Listener',
        avatar_url: profile?.avatar_url || null,
        message: text,
        is_host: session.artist_id === sender.id,
      })
      .select(
        'id, user_id, display_name, avatar_url, message, is_host, created_at',
      )
      .single();
    if (insertError || !inserted) {
      throw new BadRequestException(
        `Failed to send message: ${insertError?.message}`,
      );
    }
    return this.mapChatRow(inserted);
  }

  /** Soft-delete a chat message. Allowed for the stream host or an admin. */
  async deleteChatMessage(
    firebaseUid: string,
    sessionId: string,
    messageId: string,
  ) {
    const supabase = getSupabaseClient();
    const requester = await this.getDbUser(firebaseUid);

    const { data: session } = await supabase
      .from('artist_live_sessions')
      .select('id, artist_id')
      .eq('id', sessionId)
      .single();
    if (!session) {
      throw new NotFoundException('Live session not found');
    }
    const isHost = session.artist_id === requester.id;
    const isAdmin = requester.role === 'admin';
    if (!isHost && !isAdmin) {
      throw new ForbiddenException('Only the host or an admin can moderate chat');
    }

    const { error } = await supabase
      .from('stream_chat_messages')
      .update({ is_deleted: true })
      .eq('id', messageId)
      .eq('session_id', sessionId);
    if (error) {
      throw new BadRequestException(
        `Failed to delete message: ${error.message}`,
      );
    }
    return { deleted: true };
  }
}
