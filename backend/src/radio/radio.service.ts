import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { PushNotificationService } from '../push-notifications/push-notification.service';
import { EmojiService } from '../chat/emoji.service';
import {
  RadioStateService,
  RadioState,
  PlayDecision,
  PlaylistState,
  DEFAULT_RADIO_ID,
} from './radio-state.service';

// Default song duration if not specified (3 minutes in seconds)
const DEFAULT_DURATION_SECONDS = 180;
// Buffer time before song ends to allow for network latency (2 seconds)
const SONG_END_BUFFER_MS = 2000;

type PinnedCatalystCredit = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
};

// === Hysteresis Thresholds ===
// Uses different thresholds for entering vs exiting paid mode to prevent rapid oscillation
// when listener count hovers at the boundary (e.g., 4-5-4-5)
const THRESHOLD_ENTER_PAID = parseInt(
  process.env.THRESHOLD_ENTER_PAID || '5',
  10,
);
const THRESHOLD_EXIT_PAID = parseInt(
  process.env.THRESHOLD_EXIT_PAID || '3',
  10,
);

// Checkpoint frequency: save position to database every N songs during free rotation
const CHECKPOINT_INTERVAL = parseInt(
  process.env.CHECKPOINT_INTERVAL || '5',
  10,
);

/** Rap radio: we temporarily do not require paid_play_count for free rotation so it can play nonstop (uploaded songs are rap). */
const RAP_RADIO_ID = 'ga-nw-rap';
const WEB_PREFERRED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg'];

// Trial-by-Fire window (daily, UTC)
// Defaults: off unless TRIAL_BY_FIRE_START_UTC is set.
// Format: "HH:MM" (24h)
const TRIAL_BY_FIRE_START_UTC = (
  process.env.TRIAL_BY_FIRE_START_UTC || ''
).trim();
const TRIAL_BY_FIRE_DURATION_MIN = parseInt(
  process.env.TRIAL_BY_FIRE_DURATION_MIN || '0',
  10,
);

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

function isTrialByFireActiveAt(now: Date): {
  active: boolean;
  windowStart: Date | null;
  windowEnd: Date | null;
} {
  const start = parseUtcHm(TRIAL_BY_FIRE_START_UTC);
  const durationMin = Number.isFinite(TRIAL_BY_FIRE_DURATION_MIN)
    ? TRIAL_BY_FIRE_DURATION_MIN
    : 0;
  if (!start || durationMin <= 0)
    return { active: false, windowStart: null, windowEnd: null };

  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();

  const windowStart = new Date(Date.UTC(y, mo, d, start.h, start.m, 0, 0));
  const windowEnd = new Date(windowStart.getTime() + durationMin * 60 * 1000);

  // If now is before start, window is not active (today). If after end, not active.
  const t = now.getTime();
  return {
    active: t >= windowStart.getTime() && t < windowEnd.getTime(),
    windowStart,
    windowEnd,
  };
}

function hasPreferredWebAudioExtension(audioUrl: string | null | undefined): boolean {
  if (!audioUrl) return false;
  const raw = String(audioUrl).trim().toLowerCase();
  if (!raw) return false;
  const withoutQuery = raw.split('?')[0];
  return WEB_PREFERRED_AUDIO_EXTENSIONS.some((ext) =>
    withoutQuery.endsWith(ext),
  );
}

/**
 * Simple seeded random number generator (Mulberry32).
 * Produces deterministic sequence for reproducible shuffles.
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert string seed to numeric seed.
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministic shuffle using Fisher-Yates with seeded random.
 * Same seed always produces same shuffle order (for debugging/audit).
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const numericSeed = stringToSeed(seed);
  const rng = seededRandom(numericSeed);
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Radio service implementing:
 * - Pre-charge model: Credits deducted BEFORE playing via atomic RPC
 * - Soft-weighted random: Near-random with slight bias for credits + anti-repetition
 * - Fallback playlist: Opt-in songs and admin curated when no credited songs
 * - Two-stage artist notifications: "Up Next" (T-60s) and "Live Now"
 * - Redis-backed state management for scalability
 */
@Injectable()
export class RadioService {
  private readonly logger = new Logger(RadioService.name);
  private nextSongNotifiedFor = new Map<string, string>();

  constructor(
    @Inject(forwardRef(() => PushNotificationService))
    private readonly pushNotificationService: PushNotificationService,
    @Inject(forwardRef(() => EmojiService))
    private readonly emojiService: EmojiService,
    private readonly radioStateService: RadioStateService,
  ) {}

  private async getPinnedCatalystsForSong(
    songId: string,
  ): Promise<PinnedCatalystCredit[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_catalyst_credits')
      .select('user_id, role, users(display_name, avatar_url)')
      .eq('song_id', songId);

    if (error) {
      this.logger.warn(
        `Failed to load pinned catalysts for song ${songId}: ${error.message}`,
      );
      return [];
    }

    const rows = (data ?? []) as Array<{
      user_id: string;
      role: string;
      users?: {
        display_name?: string | null;
        avatar_url?: string | null;
      } | null;
    }>;

    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.users?.display_name ?? 'Industry Catalyst',
      avatarUrl: r.users?.avatar_url ?? null,
      role: r.role,
    }));
  }

  /**
   * Ensure audio URL is playable for clients. If it is a Supabase public URL,
   * provide a signed URL (helps when bucket privacy or CORS policies cause 403s).
   */
  private async ensurePlayableAudioUrl(audioUrl: string | null): Promise<string | null> {
    if (!audioUrl || typeof audioUrl !== 'string') return null;
    try {
      const raw = audioUrl.trim();
      if (!raw) return null;
      const normalizedHttp = raw.startsWith('http://')
        ? `https://${raw.slice('http://'.length)}`
        : raw;

      // Legacy rows may store only storage path (not full URL).
      // Convert those to a signed URL so browser playback works.
      if (!normalizedHttp.startsWith('https://')) {
        let path = normalizedHttp.replace(/^\/+/, '');
        if (path.startsWith('songs/')) {
          path = path.slice('songs/'.length);
        }
        if (!path) return null;
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.storage.from('songs').createSignedUrl(path, 60 * 60);
        if (error || !data?.signedUrl) {
          const { data: publicData } = supabase.storage.from('songs').getPublicUrl(path);
          return publicData?.publicUrl || null;
        }
        return data.signedUrl;
      }

      const publicMarker = '/storage/v1/object/public/';
      const markerIndex = normalizedHttp.indexOf(publicMarker);
      if (markerIndex === -1) return normalizedHttp;

      const after = normalizedHttp.slice(markerIndex + publicMarker.length);
      const [bucket, ...rest] = after.split('/');
      if (bucket !== 'songs' || rest.length === 0) return normalizedHttp;

      const path = rest.join('/');
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage.from('songs').createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) return normalizedHttp;
      return data.signedUrl;
    } catch {
      return audioUrl;
    }
  }

  /**
   * Credits required per play: 1 credit = 1 play.
   * (Pricing is $1/min per play, purchased per song; credits_remaining = plays remaining.)
   */
  private calculateCreditsRequired(_durationSeconds: number): number {
    return 1;
  }

  /**
   * Get queue state from Redis (with DB fallback).
   */
  private async getQueueState(radioId: string = DEFAULT_RADIO_ID): Promise<RadioState | null> {
    return this.radioStateService.getCurrentState(radioId);
  }

  /**
   * Update the current playing song in Redis + DB.
   */
  private async setCurrentSong(
    songId: string,
    durationSeconds: number,
    radioId: string,
    priorityScore: number = 0,
    isFallback: boolean = false,
    isAdminFallback: boolean = false,
  ): Promise<void> {
    const now = Date.now();
    const playedAt = new Date(now).toISOString();

    const state: RadioState = {
      songId,
      startedAt: now,
      durationMs: durationSeconds * 1000,
      priorityScore,
      isFallback,
      isAdminFallback,
      playedAt,
    };

    await this.radioStateService.setCurrentState(state, radioId);
  }

  /** Check if an admin live broadcast is currently active. */
  private async isLiveBroadcastActive(): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('live_broadcast')
      .select('id')
      .eq('status', 'active')
      .maybeSingle();
    return !!data;
  }

  /**
   * Return currently active artist livestream info for client badges/CTA.
   */
  private async getArtistLiveNow(artistId?: string | null): Promise<{
    sessionId: string;
    status: 'starting' | 'live';
    title: string | null;
    watchUrl: string | null;
    playbackHlsUrl: string | null;
    currentViewers: number;
  } | null> {
    if (!artistId) return null;
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('artist_live_sessions')
      .select('id, status, title, watch_url, playback_hls_url, current_viewers')
      .eq('artist_id', artistId)
      .in('status', ['starting', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      sessionId: data.id,
      status: data.status as 'starting' | 'live',
      title: data.title ?? null,
      watchUrl: data.watch_url ?? null,
      playbackHlsUrl: data.playback_hls_url ?? null,
      currentViewers: data.current_viewers ?? 0,
    };
  }

  /**
   * Prompt artists to go live when their song starts if livestreaming is enabled for them.
   */
  private async maybeSendGoLiveNudge(song: any): Promise<void> {
    try {
      if (!song?.artist_id) return;
      if ((process.env.ARTIST_LIVE_ENABLED || 'false').toLowerCase() !== 'true')
        return;
      const supabase = getSupabaseClient();

      const { data: profile } = await supabase
        .from('artist_live_profiles')
        .select('is_live_enabled, is_live_banned')
        .eq('user_id', song.artist_id)
        .maybeSingle();
      if (profile?.is_live_banned || profile?.is_live_enabled === false) return;

      const { data: active } = await supabase
        .from('artist_live_sessions')
        .select('id')
        .eq('artist_id', song.artist_id)
        .in('status', ['starting', 'live'])
        .maybeSingle();
      if (active) return;

      await this.pushNotificationService.sendGoLiveNudgeToArtist({
        artistId: song.artist_id,
        songId: song.id,
        songTitle: song.title ?? 'Your track',
      });
    } catch (e) {
      this.logger.warn(`Failed to send go-live nudge: ${e?.message ?? e}`);
    }
  }

  /**
   * Get the current track with timing information for client synchronization.
   * If nothing is playing, automatically starts the next track.
   */
  async getCurrentTrack(radioId: string = DEFAULT_RADIO_ID) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const isLive = await this.isLiveBroadcastActive();
    const trial = isTrialByFireActiveAt(new Date(now));

    const queueState = await this.getQueueState(radioId);

    // If nothing is playing, start the next track
    if (!queueState || !queueState.songId) {
      this.logger.log('No current track, auto-starting next track');
      return this.getNextTrack(radioId);
    }

    const isAdminSong = queueState.songId.startsWith('admin:');
    const actualSongId = queueState.songId.replace(/^admin:|^song:/, '');

    let song: any | null = null;
    if (isAdminSong) {
      const { data } = await supabase
        .from('admin_fallback_songs')
        .select('*')
        .eq('id', actualSongId)
        .eq('radio_id', radioId)
        .single();
      song = data ?? null;
    } else {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('id', actualSongId)
        .single();
      song = data ?? null;
    }

    if (!song) {
      // Song was deleted, get next track
      this.logger.log('Current song not found, auto-starting next track');
      return this.getNextTrack(radioId);
    }

    const startedAt = queueState.startedAt;
    const durationMs =
      queueState.durationMs ||
      (song.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
    const endTime = startedAt + durationMs;
    const timeRemainingMs = Math.max(0, endTime - now);

    if (
      !queueState.isAdminFallback &&
      timeRemainingMs <= 60000 &&
      timeRemainingMs > SONG_END_BUFFER_MS
    ) {
      this.checkAndScheduleUpNext(timeRemainingMs, song.id, radioId).catch((e) =>
        this.logger.warn(`Failed to schedule Up Next: ${e.message}`),
      );
    }

    // If song has ended, get next track
    if (timeRemainingMs <= 0) {
      this.logger.log('Current song ended, auto-starting next track');
      return this.getNextTrack(radioId);
    }

    const pinnedCatalysts = isAdminSong
      ? []
      : await this.getPinnedCatalystsForSong(actualSongId);

    // Current play id (for per-play voting). Prefer Redis; fallback to a DB lookup near started_at.
    let playId: string | null = null;
    try {
      const info = await this.radioStateService.getCurrentPlayInfo(radioId);
      if (info?.playId) {
        playId = info.playId;
      } else if (!isAdminSong && queueState.playedAt) {
        const startedAtMs = new Date(queueState.playedAt).getTime();
        if (Number.isFinite(startedAtMs)) {
          const lowerIso = new Date(startedAtMs - 5000).toISOString();
          const upperIso = new Date(startedAtMs + 5000).toISOString();
          const { data: playRows } = await supabase
            .from('plays')
            .select('id')
            .eq('song_id', actualSongId)
            .gte('played_at', lowerIso)
            .lte('played_at', upperIso)
            .order('played_at', { ascending: false })
            .limit(1);
          playId = (playRows ?? [])[0]?.id ?? null;
        }
      }
    } catch {
      // Best-effort only; do not break radio.
      playId = null;
    }

    const artistLiveNow = isAdminSong
      ? null
      : await this.getArtistLiveNow(song.artist_id ?? null);
    const audioUrl = await this.ensurePlayableAudioUrl(song.audio_url ?? null);

    return {
      ...song,
      audio_url: audioUrl,
      is_playing: true,
      started_at: queueState.playedAt,
      server_time: new Date(now).toISOString(),
      time_remaining_ms: timeRemainingMs,
      position_seconds: Math.floor((now - startedAt) / 1000),
      is_live: isLive,
      trial_by_fire_active: trial.active,
      pinned_catalysts: pinnedCatalysts,
      play_id: playId,
      artist_live_now: artistLiveNow,
    };
  }

  /**
   * Soft-weighted random selection.
   * Close to pure random with minor nudges:
   * - +0.1 weight for above-average credits (reward investment)
   * - +0.1 weight for not played in last hour (anti-repetition)
   * - Exclude same artist as last played when possible (artist spacing)
   */
  private selectWeightedRandom(
    songs: any[],
    currentSongId?: string,
    lastPlayedArtistId?: string | null,
  ): any | null {
    if (!songs || songs.length === 0) return null;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const avgCredits =
      songs.reduce((sum, s) => sum + (s.credits_remaining || 0), 0) /
      songs.length;

    const weightedSongs = songs.map((song) => {
      let weight = 1.0; // Base weight

      // +0.1 for above-average credits
      if ((song.credits_remaining || 0) > avgCredits) weight += 0.1;

      // +0.1 for not played recently
      if (!song.last_played_at || new Date(song.last_played_at) < oneHourAgo)
        weight += 0.1;

      // Exclude current song to avoid immediate repeat
      if (song.id === currentSongId) weight = 0;

      // Artist spacing: strongly prefer a different artist than the one that just played
      if (lastPlayedArtistId != null && song.artist_id === lastPlayedArtistId)
        weight = 0;

      return { song, weight };
    });

    const totalWeight = weightedSongs.reduce((sum, w) => sum + w.weight, 0);
    // If all songs are same artist (totalWeight 0), fall back to any song to avoid deadlock
    if (totalWeight === 0) return songs[0];

    let random = Math.random() * totalWeight;
    for (const { song, weight } of weightedSongs) {
      random -= weight;
      if (random <= 0) return song;
    }

    return songs[0];
  }

  /**
   * Resolve a queue stack ID (song:uuid or admin:uuid) to the artist_id of the song.
   * Used for artist spacing: we avoid playing the same artist back-to-back.
   * Admin fallback songs have no artist_id; returns null so no artist filter is applied.
   */
  private async getArtistIdForStackId(
    stackId: string | undefined,
  ): Promise<string | null> {
    if (!stackId) return null;
    const supabase = getSupabaseClient();
    const isAdmin = stackId.startsWith('admin:');
    const actualId = stackId.replace(/^admin:|^song:/, '');
    if (isAdmin) return null; // Admin songs: no artist spacing filter
    const { data } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', actualId)
      .single();
    return data?.artist_id ?? null;
  }

  /**
   * When the next track is about to start: update the previous play with end metrics
   * (listeners, likes/comments/profile clicks during the play) and send the artist
   * a "Your song has been played" notification with a link to view analytics.
   */
  private async finalizePreviousPlay(radioId: string = DEFAULT_RADIO_ID): Promise<void> {
    const info = await this.radioStateService.getCurrentPlayInfo(radioId);
    if (!info) return;

    const supabase = getSupabaseClient();
    const endAt = new Date().toISOString();

    const { data: play, error: playError } = await supabase
      .from('plays')
      .select('id, song_id, played_at, listener_count')
      .eq('id', info.playId)
      .single();

    if (playError || !play) {
      this.logger.warn(`Finalize play: play ${info.playId} not found`);
      await this.radioStateService.clearCurrentPlayInfo(radioId);
      return;
    }

    const listenerCountAtEnd = await this.radioStateService.getListenerCount(radioId);
    const startAt = info.startedAt;

    const [likesRes, commentsRes, profileRes] = await Promise.all([
      supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', play.song_id)
        .gte('created_at', startAt)
        .lte('created_at', endAt),
      supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startAt)
        .lte('created_at', endAt)
        .is('deleted_at', null),
      supabase
        .from('profile_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', play.song_id)
        .gte('created_at', startAt)
        .lte('created_at', endAt),
    ]);

    await supabase
      .from('plays')
      .update({
        listener_count_at_end: listenerCountAtEnd,
        likes_during: likesRes.count ?? 0,
        comments_during: commentsRes.count ?? 0,
        disconnects_during: 0,
        profile_clicks_during: profileRes.count ?? 0,
      })
      .eq('id', info.playId);

    const { data: song } = await supabase
      .from('songs')
      .select('title')
      .eq('id', play.song_id)
      .single();
    const songTitle = song?.title ?? 'Your song';

    try {
      await this.pushNotificationService.sendSongPlayedNotification({
        artistId: info.artistId,
        songTitle,
        playId: info.playId,
      });
    } catch (e) {
      this.logger.warn(
        `Failed to send song-played notification: ${e?.message ?? e}`,
      );
    }

    await this.radioStateService.clearCurrentPlayInfo(radioId);
  }

  /**
   * Get credited song using soft-weighted random selection.
   * Only returns songs with enough credits for their full play duration.
   * Prefers a different artist than last played (artist spacing).
   */
  private async getCreditedSong(
    currentSongId?: string,
    lastPlayedArtistId?: string | null,
  ): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;

    // Filter to songs with ENOUGH credits for full play
    const eligibleSongs = songs.filter((song) => {
      const creditsRequired = this.calculateCreditsRequired(
        song.duration_seconds || DEFAULT_DURATION_SECONDS,
      );
      return (song.credits_remaining || 0) >= creditsRequired;
    });

    if (eligibleSongs.length === 0) return null;
    const webPlayableSongs = eligibleSongs.filter((song) =>
      hasPreferredWebAudioExtension(song.audio_url),
    );
    if (webPlayableSongs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(
      webPlayableSongs,
      currentSongId,
      lastPlayedArtistId,
    );
    return { song: selectedSong, competingSongs: webPlayableSongs.length };
  }

  /**
   * Get trial song for artists with free trial plays remaining.
   * Only returns songs with trial plays available and no credits.
   * Prefers a different artist than last played (artist spacing).
   */
  private async getTrialSong(
    currentSongId?: string,
    lastPlayedArtistId?: string | null,
  ): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('trial_plays_remaining', 0)
      .lte('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;
    const webPlayableSongs = songs.filter((song) =>
      hasPreferredWebAudioExtension(song.audio_url),
    );
    if (webPlayableSongs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(
      webPlayableSongs,
      currentSongId,
      lastPlayedArtistId,
    );
    return { song: selectedSong, competingSongs: webPlayableSongs.length };
  }

  /**
   * Get free-rotation eligible song after trial plays are exhausted.
   * Admin controls free rotation eligibility via admin_free_rotation.
   * Prefers a different artist than last played (artist spacing).
   */
  private async getOptInSong(
    currentSongId?: string,
    lastPlayedArtistId?: string | null,
  ): Promise<{ song: any; competingSongs: number } | null> {
    const supabase = getSupabaseClient();

    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .eq('admin_free_rotation', true)
      .lte('trial_plays_remaining', 0)
      .lte('credits_remaining', 0);

    if (!songs || songs.length === 0) return null;
    const webPlayableSongs = songs.filter((song) =>
      hasPreferredWebAudioExtension(song.audio_url),
    );
    if (webPlayableSongs.length === 0) return null;

    const selectedSong = this.selectWeightedRandom(
      webPlayableSongs,
      currentSongId,
      lastPlayedArtistId,
    );
    return { song: selectedSong, competingSongs: webPlayableSongs.length };
  }

  // === Free Rotation Stack Methods ===

  /**
   * Get all active songs from free rotation: admin_fallback_songs + songs table (admin_free_rotation).
   * Returns artistId for artist-spaced shuffle: admin entries use unique id so they don't cluster.
   */
  private async getAllFreeRotationSongs(radioId: string = DEFAULT_RADIO_ID): Promise<
    { id: string; _stackId: string; artistId: string }[]
  > {
    const supabase = getSupabaseClient();
    const result: { id: string; _stackId: string; artistId: string }[] = [];

    const { data: adminSongs, error: adminError } = await supabase
      .from('admin_fallback_songs')
      .select('id')
      .eq('radio_id', radioId)
      .eq('is_active', true);

    if (adminError) {
      this.logger.error(
        `Failed to fetch admin fallback songs: ${adminError.message}`,
      );
    } else if (adminSongs?.length) {
      for (const s of adminSongs) {
        result.push({
          id: s.id,
          _stackId: `admin:${s.id}`,
          artistId: `admin:${s.id}`,
        });
      }
    }

    let songsQuery = supabase
      .from('songs')
      .select('id, artist_id, audio_url')
      .eq('status', 'approved')
      .eq('admin_free_rotation', true);
    // Temporarily skip paid-play requirement for rap radio so it can play nonstop (uploaded songs are only rap)
    if (radioId !== RAP_RADIO_ID) {
      songsQuery = songsQuery.gt('paid_play_count', 0);
    }
    const { data: songsData, error: songsError } = await songsQuery;

    if (songsError) {
      this.logger.error(
        `Failed to fetch admin-free-rotation songs: ${songsError.message}`,
      );
    } else if (songsData?.length) {
      const preferredForWeb = songsData.filter((s) =>
        hasPreferredWebAudioExtension(
          (s as { audio_url?: string | null }).audio_url ?? null,
        ),
      );
      // Keep rotation web-playable to avoid "silent spinner / no audio" tracks.
      const candidateSongs = preferredForWeb;
      const candidateIds = new Set(candidateSongs.map((candidate) => candidate.id));
      for (const s of songsData) {
        const artistId =
          (s as { artist_id?: string }).artist_id ?? `unknown:${s.id}`;
        if (!candidateIds.has(s.id)) {
          continue;
        }
        result.push({ id: s.id, _stackId: `song:${s.id}`, artistId });
      }
    }

    return result;
  }

  /**
   * Build an ordered list of stack IDs so that songs from the same artist are spaced out
   * (round-robin by artist). Shuffles within each artist's group so order isn't predictable.
   */
  private shuffleWithArtistSpacing(
    items: { _stackId: string; artistId: string }[],
  ): string[] {
    if (items.length === 0) return [];
    const byArtist = new Map<string, string[]>();
    for (const item of items) {
      const list = byArtist.get(item.artistId) ?? [];
      list.push(item._stackId);
      byArtist.set(item.artistId, list);
    }
    // Shuffle within each artist's list so we don't always play the same track order
    for (const list of byArtist.values()) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    const artistKeys = [...byArtist.keys()];
    // Shuffle artist order so round-robin order isn't deterministic
    for (let i = artistKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [artistKeys[i], artistKeys[j]] = [artistKeys[j], artistKeys[i]];
    }
    const result: string[] = [];
    let index = 0;
    while (result.length < items.length) {
      for (const artistId of artistKeys) {
        const list = byArtist.get(artistId)!;
        if (index < list.length) {
          result.push(list[index]);
        }
      }
      index++;
    }
    return result;
  }

  /**
   * Get a specific free rotation song by stack ID (admin:uuid, song:uuid, or legacy plain uuid).
   */
  private async getFreeRotationSongById(stackId: string, radioId: string = DEFAULT_RADIO_ID): Promise<any | null> {
    const supabase = getSupabaseClient();
    const isAdmin = stackId.startsWith('admin:');
    const isSong = stackId.startsWith('song:');
    const actualId = stackId.replace(/^admin:|^song:/, '');

    if (isAdmin) {
      const { data, error } = await supabase
        .from('admin_fallback_songs')
        .select('*')
        .eq('id', actualId)
        .eq('radio_id', radioId)
        .single();
      if (error || !data) {
        this.logger.warn(`Admin fallback song ${actualId} not found`);
        return null;
      }
      return { ...data, _source: 'admin_fallback' as const };
    }

    if (isSong) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', actualId)
        .single();
      if (error || !data) {
        this.logger.warn(`Free rotation song ${actualId} not found`);
        return null;
      }
      return { ...data, _source: 'songs' as const };
    }

    // Legacy: plain uuid (try admin_fallback first, then songs)
    const { data: adminData } = await supabase
      .from('admin_fallback_songs')
      .select('*')
      .eq('id', stackId)
      .eq('radio_id', radioId)
      .single();
    if (adminData) return { ...adminData, _source: 'admin_fallback' as const };

    let songQuery = supabase
      .from('songs')
      .select('*')
      .eq('id', stackId)
      .eq('status', 'approved')
      .eq('admin_free_rotation', true);
    // Rap radio: do not require paid_play_count (see RAP_RADIO_ID / getAllFreeRotationSongs)
    if (radioId !== RAP_RADIO_ID) {
      songQuery = songQuery.gt('paid_play_count', 0);
    }
    const { data: songData } = await songQuery.single();
    if (songData) return { ...songData, _source: 'songs' as const };

    return null;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm.
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /** Normalize prefixed stack ids (admin:/song:) to bare id for repeat checks. */
  private normalizeStackSongId(songId: string): string {
    return songId.replace(/^admin:|^song:/, '');
  }

  /**
   * Get the next song from the free rotation stack.
   * If the stack is empty, fetches all songs from admin_fallback_songs,
   * shuffles them, and stores in the stack.
   * Uses stack_version_hash to only write full stack when content changes.
   * Returns null if no free rotation songs are available.
   */
  private async getNextFreeRotationSong(
    radioId: string = DEFAULT_RADIO_ID,
    excludeSongId?: string,
  ): Promise<any | null> {
    const excludedComparable = excludeSongId
      ? this.normalizeStackSongId(excludeSongId)
      : null;
    let songId = await this.radioStateService.popFreeRotationSong(radioId);

    if (!songId) {
      const allSongs = await this.getAllFreeRotationSongs(radioId);

      if (allSongs.length === 0) {
        this.logger.warn(
          'No free rotation songs available (admin_fallback_songs or songs with admin_free_rotation)',
        );
        return null;
      }

      const shuffledIds = this.shuffleWithArtistSpacing(allSongs);

      await this.radioStateService.setFreeRotationStack(shuffledIds, radioId);

      await this.saveStackIfChanged(shuffledIds, radioId);

      await this.radioStateService.setFallbackPosition(0, radioId);

      this.logger.log(
        `Refilled free rotation stack with ${shuffledIds.length} shuffled songs`,
      );

      songId = await this.radioStateService.popFreeRotationSong(radioId);

      // Fallback when Redis is unavailable: pick random song directly from shuffled list
      if (!songId && shuffledIds.length > 0) {
        const randomPool = excludedComparable
          ? shuffledIds.filter(
              (id) => this.normalizeStackSongId(id) !== excludedComparable,
            )
          : shuffledIds;
        const candidatePool = randomPool.length > 0 ? randomPool : shuffledIds;
        songId =
          candidatePool[Math.floor(Math.random() * candidatePool.length)];
        this.logger.log(
          'Redis unavailable - picked random song directly from pool',
        );
      }
    }

    if (!songId) {
      return null;
    }

    // Fetch the full song data
    let pickedSong = await this.getFreeRotationSongById(songId, radioId);
    const pickedComparable = this.normalizeStackSongId(songId);

    // Guard against immediate repeat when alternatives exist.
    if (excludedComparable && pickedComparable === excludedComparable) {
      // Try next item in stack first.
      const alternateStackId = await this.radioStateService.popFreeRotationSong(
        radioId,
      );
      if (
        alternateStackId &&
        this.normalizeStackSongId(alternateStackId) !== excludedComparable
      ) {
        const alternateSong = await this.getFreeRotationSongById(
          alternateStackId,
          radioId,
        );
        if (alternateSong) return alternateSong;
      }

      // Final fallback: random non-repeating item from full pool.
      const allSongs = await this.getAllFreeRotationSongs(radioId);
      const alternatives = allSongs.filter(
        (s) => this.normalizeStackSongId(s._stackId) !== excludedComparable,
      );
      if (alternatives.length > 0) {
        const pickedAlt =
          alternatives[Math.floor(Math.random() * alternatives.length)];
        const altSong = await this.getFreeRotationSongById(
          pickedAlt._stackId,
          radioId,
        );
        if (altSong) return altSong;
      }
    }

    return pickedSong;
  }

  /**
   * Save stack to Supabase only if the content has changed.
   */
  private async saveStackIfChanged(newStack: string[], radioId: string = DEFAULT_RADIO_ID): Promise<void> {
    const supabase = getSupabaseClient();
    const crypto = require('crypto');

    const newHash = crypto
      .createHash('md5')
      .update(newStack.sort().join(','))
      .digest('hex');

    const { data } = await supabase
      .from('radio_playlist_state')
      .select('stack_version_hash')
      .eq('radio_id', radioId)
      .single();

    const currentHash = data?.stack_version_hash;

    if (currentHash !== newHash) {
      await this.radioStateService.saveFullPlaylistState(newStack, 0, radioId);
      this.logger.log(
        `Stack content changed - saved full stack to Supabase (${newStack.length} songs)`,
      );
    } else {
      this.logger.log('Stack content unchanged - skipping full stack write');
    }
  }

  /**
   * Get the next track for the global radio stream.
   * Production-ready flow with hysteresis:
   * 1. Check if song currently playing - if so, return it
   * 2. Get listener count and current playlist type
   * 3. Apply hysteresis logic to determine target playlist type
   * 4. Handle playlist switch if needed (save/restore positions)
   * 5. Play from appropriate playlist with checkpointing
   */
  async getNextTrack(radioId: string = DEFAULT_RADIO_ID): Promise<any> {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const isLive = await this.isLiveBroadcastActive();
    const trial = isTrialByFireActiveAt(new Date(now));

    const currentState = await this.getQueueState(radioId);

    // Check if song currently playing
    if (currentState?.songId && currentState?.startedAt) {
      const isAdminSong = currentState.songId.startsWith('admin:');
      const actualSongId = currentState.songId.replace(/^admin:|^song:/, '');

      let currentSong;
      if (isAdminSong) {
        const { data } = await supabase
.from('admin_fallback_songs')
      .select('*')
      .eq('id', actualSongId)
      .eq('radio_id', radioId)
      .single();
    currentSong = data;
      } else {
        const { data } = await supabase
          .from('songs')
          .select('*')
          .eq('id', actualSongId)
          .single();
        currentSong = data;
      }

      if (currentSong) {
        const startedAt = currentState.startedAt;
        const durationMs =
          currentState.durationMs ||
          (currentSong.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
        const endTime = startedAt + durationMs;
        const timeRemainingMs = endTime - now;

        if (timeRemainingMs > SONG_END_BUFFER_MS) {
          const pinnedCatalysts = currentState.isAdminFallback
            ? []
            : await this.getPinnedCatalystsForSong(actualSongId);
          const artistLiveNow = currentState.isAdminFallback
            ? null
            : await this.getArtistLiveNow(currentSong.artist_id ?? null);
          const audioUrl = await this.ensurePlayableAudioUrl(
            currentSong.audio_url ?? null,
          );
          return {
            ...currentSong,
            audio_url: audioUrl,
            is_playing: true,
            started_at: currentState.playedAt,
            server_time: new Date(now).toISOString(),
            time_remaining_ms: timeRemainingMs,
            position_seconds: Math.floor((now - startedAt) / 1000),
            is_fallback: currentState.isFallback,
            is_admin_fallback: currentState.isAdminFallback,
            is_live: isLive,
            trial_by_fire_active: trial.active,
            pinned_catalysts: pinnedCatalysts,
            artist_live_now: artistLiveNow,
          };
        }
      }
    }

    const currentSongId = currentState?.songId;
    this.nextSongNotifiedFor.delete(radioId);

    // Finalize previous play: update per-play metrics and send "Your song has been played" notification
    await this.finalizePreviousPlay(radioId);

    // Resolve last-played artist for spacing (avoid same artist back-to-back)
    const lastPlayedArtistId = await this.getArtistIdForStackId(
      currentSongId ?? undefined,
    );

    // Get listener count and current playlist type
    const listenerCount = await this.radioStateService.getListenerCount(radioId);
    const currentType = await this.radioStateService.getCurrentPlaylistType(radioId);

    // Apply hysteresis logic to determine target playlist type
    let targetType = currentType;

    // Rap station is intended to run nonstop free rotation.
    if (radioId === RAP_RADIO_ID) {
      targetType = 'free_rotation';
    }

    if (
      radioId !== RAP_RADIO_ID &&
      currentType === 'free_rotation' &&
      listenerCount >= THRESHOLD_ENTER_PAID
    ) {
      targetType = 'paid';
      this.logger.log(
        `Switching to PAID playlist (listeners: ${listenerCount} >= ${THRESHOLD_ENTER_PAID})`,
      );
    } else if (
      radioId !== RAP_RADIO_ID &&
      currentType === 'paid' &&
      listenerCount <= THRESHOLD_EXIT_PAID
    ) {
      targetType = 'free_rotation';
      this.logger.log(
        `Switching to FREE playlist (listeners: ${listenerCount} <= ${THRESHOLD_EXIT_PAID})`,
      );
    }

    // Handle playlist switch if type changed
    if (currentType !== targetType) {
      await this.handlePlaylistSwitch(currentType, targetType, radioId);
    }

    this.logger.log(
      `Current listener count: ${listenerCount}, playlist type: ${targetType}`,
    );

    // Play from appropriate playlist
    if (targetType === 'paid') {
      const creditedResult = await this.getCreditedSong(
        currentSongId,
        lastPlayedArtistId,
      );
      if (creditedResult) {
        const result = await this.playCreditedSong(
          creditedResult.song,
          creditedResult.competingSongs,
          radioId,
        );
        if (result) {
          const artistLiveNow = await this.getArtistLiveNow(
            result.artist_id ?? null,
          );
          return {
            ...result,
            is_live: isLive,
            trial_by_fire_active: trial.active,
            artist_live_now: artistLiveNow,
          };
        }
      }

      // Try trial songs (3 free plays), with artist spacing
      const trialResult = await this.getTrialSong(
        currentSongId,
        lastPlayedArtistId,
      );
      if (trialResult) {
        const result = await this.playTrialSong(
          trialResult.song,
          trialResult.competingSongs,
          radioId,
        );
        if (result) {
          const artistLiveNow = await this.getArtistLiveNow(
            result.artist_id ?? null,
          );
          return {
            ...result,
            is_live: isLive,
            trial_by_fire_active: trial.active,
            artist_live_now: artistLiveNow,
          };
        }
      }

      // Try opt-in songs (free rotation opt-in), with artist spacing
      const optInResult = await this.getOptInSong(
        currentSongId,
        lastPlayedArtistId,
      );
      if (optInResult) {
        const result = await this.playOptInSong(
          optInResult.song,
          optInResult.competingSongs,
          radioId,
        );
        if (result) {
          const artistLiveNow = await this.getArtistLiveNow(
            result.artist_id ?? null,
          );
          return {
            ...result,
            is_live: isLive,
            trial_by_fire_active: trial.active,
            artist_live_now: artistLiveNow,
          };
        }
      }

      // No credited, trial, or opt-in songs available - fall back to free rotation
      this.logger.log(
        'No credited, trial, or opt-in songs available in paid mode, falling back to free rotation',
      );
    }

    // Free rotation mode (or fallback from paid mode)
    const freeRotationSong = await this.getNextFreeRotationSong(
      radioId,
      currentSongId ?? undefined,
    );
    if (freeRotationSong) {
      this.logger.log(`Playing free rotation song: ${freeRotationSong.title}`);
      const result = await this.playFreeRotationSong(freeRotationSong, radioId);

      const position = await this.radioStateService.getFallbackPosition(radioId);
      await this.radioStateService.checkpointPosition(position + 1, radioId);

      return {
        ...result,
        is_live: isLive,
        trial_by_fire_active: trial.active,
        artist_live_now: null,
      };
    }

    // No content available
    this.logger.warn(
      'No songs available for playback - free rotation table is empty',
    );
    return {
      ...this.buildNoContentResponse(),
      is_live: isLive,
      trial_by_fire_active: trial.active,
      artist_live_now: null,
    };
  }

  /**
   * Handle playlist switch with state persistence.
   * Saves current position before switching, loads saved position when returning.
   */
  private async handlePlaylistSwitch(
    from: 'free_rotation' | 'paid',
    to: 'free_rotation' | 'paid',
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (from === 'free_rotation' && to === 'paid') {
      const position = await this.radioStateService.getFallbackPosition(radioId);
      await this.radioStateService.syncPositionToSupabase(position, radioId);
      this.logger.log(
        `Saved free rotation position before switching to paid: ${position}`,
      );
    } else if (from === 'paid' && to === 'free_rotation') {
      const state = await this.radioStateService.loadPlaylistStateFromDb(radioId);
      if (state) {
        if (state.fallbackStack.length > 0) {
          await this.radioStateService.setFreeRotationStack(
            state.fallbackStack,
            radioId,
          );
        }
        await this.radioStateService.setFallbackPosition(
          state.fallbackPosition,
          radioId,
        );
        this.logger.log(
          `Restored free rotation at position: ${state.fallbackPosition}`,
        );
      }
    }

    await this.radioStateService.setCurrentPlaylistType(to, radioId);
    await this.radioStateService.resetCheckpointCounter(radioId);
  }

  /**
   * Play a credited song using pre-charge model (atomic RPC).
   * Also sends "Live Now" notification to the artist and logs the decision.
   */
  private async playCreditedSong(
    song: any,
    competingSongs: number = 0,
    radioId: string = DEFAULT_RADIO_ID,
  ) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;
    const creditsToDeduct = this.calculateCreditsRequired(durationSeconds);

    // Atomic deduction via RPC (pre-charge)
    const { data, error } = await supabase.rpc('deduct_play_credits', {
      p_song_id: song.id,
      p_credits_required: creditsToDeduct,
    });

    if (error || !data?.success) {
      this.logger.warn(
        `Failed to deduct credits for ${song.id}: ${error?.message || data?.error}`,
      );
      return null;
    }

    await this.setCurrentSong(song.id, durationSeconds, radioId, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Log play decision for transparency
    const listenerCount = await this.radioStateService.getListenerCount(radioId);
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'credits',
      listenerCount,
      competingSongs,
    });

    // Log play and set current play for finalization (per-play metrics + "song played" notification)
    const { data: playRow } = await supabase
      .from('plays')
      .insert({
        song_id: song.id,
        played_at: startedAt,
        listener_count: listenerCount,
      })
      .select('id')
      .single();
    if (playRow?.id && song.artist_id) {
      await this.radioStateService.setCurrentPlayInfo(
        playRow.id,
        song.artist_id,
        startedAt,
        radioId,
      );
    }

    // Increment paid_play_count, play_count, last_played_at
    await supabase
      .from('songs')
      .update({
        paid_play_count: (song.paid_play_count || 0) + 1,
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    // Send "Live Now" notification to artist (Stage 2)
    try {
      await this.pushNotificationService.sendLiveNowNotification({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
      });
    } catch (e) {
      this.logger.warn(`Failed to send Live Now notification: ${e.message}`);
    }

    await this.maybeSendGoLiveNudge(song);

    const durationMs = durationSeconds * 1000;
    const pinnedCatalysts = await this.getPinnedCatalystsForSong(song.id);
    const audioUrl = await this.ensurePlayableAudioUrl(song.audio_url ?? null);

    return {
      ...song,
      audio_url: audioUrl,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      credits_deducted: creditsToDeduct,
      pinned_catalysts: pinnedCatalysts,
    };
  }

  /**
   * Play a trial song (free plays before credits are required).
   */
  private async playTrialSong(song: any, competingSongs: number = 0, radioId: string = DEFAULT_RADIO_ID) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    await this.setCurrentSong(song.id, durationSeconds, radioId, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Decrement trial plays, increment used counter, update last_played_at and play_count
    const remaining = Math.max(0, (song.trial_plays_remaining || 0) - 1);
    const used = (song.trial_plays_used || 0) + 1;
    await supabase
      .from('songs')
      .update({
        trial_plays_remaining: remaining,
        trial_plays_used: used,
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount(radioId);
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'trial',
      listenerCount,
      competingSongs,
    });

    // Log play and set current play for finalization
    const { data: playRow } = await supabase
      .from('plays')
      .insert({
        song_id: song.id,
        played_at: startedAt,
        listener_count: listenerCount,
      })
      .select('id')
      .single();
    if (playRow?.id && song.artist_id) {
      await this.radioStateService.setCurrentPlayInfo(
        playRow.id,
        song.artist_id,
        startedAt,
        radioId,
      );
    }

    // Send "Live Now" notification to artist
    try {
      await this.pushNotificationService.sendLiveNowNotification({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
      });
    } catch (e) {
      this.logger.warn(`Failed to send Live Now notification: ${e.message}`);
    }

    await this.maybeSendGoLiveNudge(song);

    const durationMs = durationSeconds * 1000;
    const pinnedCatalysts = await this.getPinnedCatalystsForSong(song.id);
    const audioUrl = await this.ensurePlayableAudioUrl(song.audio_url ?? null);

    return {
      ...song,
      audio_url: audioUrl,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      trial_plays_remaining: remaining,
      trial_plays_used: used,
      pinned_catalysts: pinnedCatalysts,
    };
  }

  /**
   * Play an opt-in song (free rotation opt-in).
   */
  private async playOptInSong(song: any, competingSongs: number = 0, radioId: string = DEFAULT_RADIO_ID) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;

    await this.setCurrentSong(song.id, durationSeconds, radioId, 0, false, false);

    // Update emoji service with current song for aggregation
    this.emojiService.setCurrentSong(song.id);

    // Log play decision
    const listenerCount = await this.radioStateService.getListenerCount(radioId);
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'opt_in',
      listenerCount,
      competingSongs,
    });

    // Log play and set current play for finalization
    const { data: playRow } = await supabase
      .from('plays')
      .insert({
        song_id: song.id,
        played_at: startedAt,
        listener_count: listenerCount,
      })
      .select('id')
      .single();
    if (playRow?.id && song.artist_id) {
      await this.radioStateService.setCurrentPlayInfo(
        playRow.id,
        song.artist_id,
        startedAt,
        radioId,
      );
    }

    // Update play_count and last_played_at
    await supabase
      .from('songs')
      .update({
        play_count: (song.play_count || 0) + 1,
        last_played_at: startedAt,
      })
      .eq('id', song.id);

    // Send "Live Now" notification to artist
    try {
      await this.pushNotificationService.sendLiveNowNotification({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id,
        artist_name: song.artist_name,
      });
    } catch (e) {
      this.logger.warn(`Failed to send Live Now notification: ${e.message}`);
    }

    await this.maybeSendGoLiveNudge(song);

    const durationMs = durationSeconds * 1000;
    const pinnedCatalysts = await this.getPinnedCatalystsForSong(song.id);
    const audioUrl = await this.ensurePlayableAudioUrl(song.audio_url ?? null);

    return {
      ...song,
      audio_url: audioUrl,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      pinned_catalysts: pinnedCatalysts,
    };
  }

  /**
   * Play a song from the free rotation (admin_fallback_songs or songs table).
   * Uses the shuffled stack pattern - songs are played in random order
   * and the stack is refilled when empty.
   */
  private async playFreeRotationSong(song: any, radioId: string = DEFAULT_RADIO_ID) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();
    const durationSeconds = song.duration_seconds || DEFAULT_DURATION_SECONDS;
    const isFromAdminTable = song._source === 'admin_fallback';
    const stateSongId = isFromAdminTable ? `admin:${song.id}` : song.id;

    await this.radioStateService.setCurrentState({
      songId: stateSongId,
      startedAt: now,
      durationMs: durationSeconds * 1000,
      priorityScore: 0,
      isFallback: true,
      isAdminFallback: true,
      playedAt: startedAt,
    }, radioId);

    const listenerCount = await this.radioStateService.getListenerCount(radioId);
    await this.radioStateService.logPlayDecision({
      songId: song.id,
      selectedAt: startedAt,
      selectionReason: 'admin_fallback',
      listenerCount,
    });

    if (isFromAdminTable) {
      await supabase
        .from('admin_fallback_songs')
        .update({
          play_count: (song.play_count || 0) + 1,
          last_played_at: startedAt,
        })
        .eq('id', song.id)
        .eq('radio_id', radioId);
    } else {
      const { data: playRow } = await supabase
        .from('plays')
        .insert({
          song_id: song.id,
          played_at: startedAt,
          listener_count: listenerCount,
        })
        .select('id')
        .single();
      if (playRow?.id && song.artist_id) {
        await this.radioStateService.setCurrentPlayInfo(
          playRow.id,
          song.artist_id,
          startedAt,
          radioId,
        );
      }
      // Update songs table play_count and last_played_at
      await supabase
        .from('songs')
        .update({
          play_count: (song.play_count || 0) + 1,
          last_played_at: startedAt,
        })
        .eq('id', song.id);
    }

    const durationMs = durationSeconds * 1000;
    const pinnedCatalysts = isFromAdminTable
      ? []
      : await this.getPinnedCatalystsForSong(song.id);
    const audioUrl = await this.ensurePlayableAudioUrl(song.audio_url ?? null);

    return {
      id: song.id,
      title: song.title,
      artist_name: song.artist_name,
      audio_url: audioUrl,
      artwork_url: song.artwork_url,
      duration_seconds: durationSeconds,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
      is_fallback: true,
      is_admin_fallback: true,
      pinned_catalysts: pinnedCatalysts,
    };
  }

  /**
   * Build response when no content is available.
   * This happens when the free rotation table is empty.
   */
  private buildNoContentResponse(): any {
    const now = new Date().toISOString();

    return {
      id: null,
      title: 'No Content Available',
      artist_name: 'RadioApp',
      audio_url: null,
      artwork_url: null,
      duration_seconds: 0,
      is_playing: false,
      started_at: now,
      server_time: now,
      time_remaining_ms: 0,
      position_seconds: 0,
      is_fallback: true,
      is_admin_fallback: true,
      no_content: true,
      message: 'Sorry for the inconvenience. No songs are currently available.',
    };
  }

  async reportPlay(songId: string, skipped: boolean = false) {
    const supabase = getSupabaseClient();

    await supabase.from('plays').insert({
      song_id: songId,
      skipped,
      played_at: new Date().toISOString(),
    });

    if (skipped) {
      const { data: song } = await supabase
        .from('songs')
        .select('skip_count')
        .eq('id', songId)
        .single();

      if (song) {
        await supabase
          .from('songs')
          .update({ skip_count: (song.skip_count || 0) + 1 })
          .eq('id', songId);
      }
    }
  }

  /**
   * Get upcoming songs in the queue (for preview/admin purposes).
   */
  async getUpcomingQueue(limit: number = 10, radioId: string = DEFAULT_RADIO_ID) {
    const supabase = getSupabaseClient();

    const currentState = await this.getQueueState(radioId);
    const currentSongId = currentState?.songId;

    // Get credited songs
    const { data: creditedSongs } = await supabase
      .from('songs')
      .select(
        'id, title, artist_name, artwork_url, credits_remaining, play_count, like_count, duration_seconds',
      )
      .eq('status', 'approved')
      .gt('credits_remaining', 0);

    // Filter eligible songs
    const eligible = (creditedSongs || []).filter((song) => {
      const creditsRequired = this.calculateCreditsRequired(
        song.duration_seconds || DEFAULT_DURATION_SECONDS,
      );
      return (
        song.credits_remaining >= creditsRequired && song.id !== currentSongId
      );
    });

    // Sort by credits (higher first for preview)
    eligible.sort(
      (a, b) => (b.credits_remaining || 0) - (a.credits_remaining || 0),
    );

    return eligible.slice(0, limit);
  }

  /**
   * Clear the current queue state (useful for admin operations).
   */
  async clearQueueState(radioId: string = DEFAULT_RADIO_ID) {
    await this.radioStateService.clearState(radioId);
    return { cleared: true };
  }

  /**
   * Preview the next song for Up Next notifications without changing state.
   */
  private async preSelectNextSong(
    currentSongId?: string,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<any | null> {
    const creditedResult = await this.getCreditedSong(currentSongId);
    if (creditedResult) return creditedResult.song;

    const trialResult = await this.getTrialSong(currentSongId);
    if (trialResult) return trialResult.song;

    const optInResult = await this.getOptInSong(currentSongId);
    if (optInResult) return optInResult.song;

    // Keep fallback preview scoped to station.
    const fallbackSong = await this.getNextFreeRotationSong(radioId, currentSongId);
    if (fallbackSong) return fallbackSong;

    return null;
  }

  /**
   * Schedule Up Next notification around 60 seconds before the song ends.
   */
  private async checkAndScheduleUpNext(
    timeRemainingMs: number,
    currentSongId: string,
    radioId: string = DEFAULT_RADIO_ID,
  ): Promise<void> {
    if (timeRemainingMs > 60000 || timeRemainingMs < 30000) return;
    if (this.nextSongNotifiedFor.get(radioId) === currentSongId) return;

    const nextSong = await this.preSelectNextSong(currentSongId, radioId);
    if (nextSong) {
      await this.pushNotificationService.scheduleUpNextNotification(
        nextSong,
        60,
      );
      this.nextSongNotifiedFor.set(radioId, currentSongId);
    }
  }
}
