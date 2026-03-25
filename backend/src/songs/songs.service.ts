import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { CreateSongDto } from './dto/create-song.dto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface DiscoverSongCard {
  songId: string;
  artistId: string;
  artistName: string;
  artistDisplayName: string | null;
  artistAvatarUrl: string | null;
  artistHeadline: string | null;
  title: string;
  clipUrl: string;
  backgroundUrl: string | null;
  clipDurationSeconds: number;
  likeCount: number;
  likedByMe: boolean;
}

export interface DiscoverFeedResponse {
  items: DiscoverSongCard[];
  nextCursor: string | null;
}

export interface DiscoverLikedListItem extends DiscoverSongCard {
  likedAt: string;
}

interface ArtistLikeNotificationSettings {
  muted: boolean;
  minLikesTrigger: number;
  cooldownMinutes: number;
  lastNotifiedAt: string | null;
}

@Injectable()
export class SongsService {
  private readonly discoverMaxClipSeconds = 15;
  private readonly ffmpegConfigured: boolean;
  private readonly defaultArtistLikeNotificationSettings: ArtistLikeNotificationSettings =
    {
      muted: false,
      minLikesTrigger: 1,
      cooldownMinutes: 0,
      lastNotifiedAt: null,
    };

  constructor() {
    const configuredPath = (process.env.FFMPEG_PATH || '').trim();
    const bundledPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
    const ffmpegPath = configuredPath || bundledPath;
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
      this.ffmpegConfigured = true;
    } else {
      this.ffmpegConfigured = false;
    }
  }

  private async createTrimmedDiscoverClip(params: {
    sourceUrl: string;
    artistId: string;
    songKey: string;
    startSeconds: number;
    endSeconds: number;
  }): Promise<string> {
    const supabase = getSupabaseClient();
    const sourceResponse = await fetch(params.sourceUrl);
    if (!sourceResponse.ok) {
      throw new BadRequestException(
        `Failed to fetch source discover audio: ${sourceResponse.status} ${sourceResponse.statusText}`,
      );
    }
    const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
    if (!sourceBuffer.length) {
      throw new BadRequestException('Discover clip source audio is empty');
    }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputPath = join(
      tmpdir(),
      `discover-input-${params.songKey}-${runId}.bin`,
    );
    const outputPath = join(
      tmpdir(),
      `discover-output-${params.songKey}-${runId}.mp3`,
    );
    const duration = params.endSeconds - params.startSeconds;

    try {
      if (!this.ffmpegConfigured) {
        throw new BadRequestException(
          'FFmpeg is not configured on the server. Set FFMPEG_PATH or install ffmpeg.',
        );
      }
      await fs.writeFile(inputPath, sourceBuffer);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(params.startSeconds)
          .duration(duration)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .format('mp3')
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      });

      const trimmedBuffer = await fs.readFile(outputPath);
      if (!trimmedBuffer.length) {
        throw new BadRequestException('Trimmed discover clip is empty');
      }

      const storagePath = `${params.artistId}/discover-clips/${params.songKey}-${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('songs')
        .upload(storagePath, trimmedBuffer, {
          contentType: 'audio/mpeg',
          upsert: false,
        });
      if (uploadError) {
        throw new BadRequestException(
          `Failed to upload trimmed discover clip: ${uploadError.message}`,
        );
      }
      const { data: publicUrlData } = supabase.storage
        .from('songs')
        .getPublicUrl(storagePath);
      return publicUrlData.publicUrl;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Failed to trim discover clip. Ensure ffmpeg is available on the server or set FFMPEG_PATH. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
    }
  }

  private async upsertCoreLikeWithFallback(
    userId: string,
    songId: string,
    artistId: string | null | undefined,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const withArtist = {
      user_id: userId,
      song_id: songId,
      artist_id: artistId ?? null,
    };
    let likeRes = await supabase
      .from('likes')
      .upsert(withArtist, { onConflict: 'user_id,song_id' });

    if (
      likeRes.error &&
      this.isMissingColumnError(likeRes.error, 'artist_id')
    ) {
      const withoutArtist = {
        user_id: userId,
        song_id: songId,
      };
      likeRes = await supabase
        .from('likes')
        .upsert(withoutArtist, { onConflict: 'user_id,song_id' });
    }

    if (likeRes.error) {
      throw new Error(
        `Failed to save discover like fallback: ${likeRes.error.message}`,
      );
    }
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42P01') {
      return message.includes(tableName.toLowerCase());
    }
    // PostgREST schema cache error format for missing table:
    // "Could not find the table 'table_name' in the schema cache"
    if (maybe?.code === 'PGRST205') {
      return (
        message.includes(`'${tableName.toLowerCase()}'`) ||
        message.includes(tableName.toLowerCase())
      );
    }
    return false;
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42703') {
      return message.includes(columnName.toLowerCase());
    }
    // PostgREST schema cache error format:
    // "Could not find the 'column_name' column of 'table' in the schema cache"
    if (maybe?.code === 'PGRST204') {
      return (
        message.includes(`'${columnName.toLowerCase()}'`) ||
        message.includes(columnName.toLowerCase())
      );
    }
    return false;
  }

  private isMissingAnyColumnError(
    error: unknown,
    columnNames: string[],
  ): boolean {
    return columnNames.some((columnName) =>
      this.isMissingColumnError(error, columnName),
    );
  }

  private isMissingArtistLikeNotificationSettingsTable(
    error: unknown,
  ): boolean {
    return this.isMissingTableError(error, 'artist_like_notification_settings');
  }

  private mapArtistLikeNotificationSettings(
    row: any,
  ): ArtistLikeNotificationSettings {
    return {
      muted: row?.muted === true,
      minLikesTrigger: Math.max(1, Number(row?.min_likes_trigger ?? 1)),
      cooldownMinutes: Math.max(0, Number(row?.cooldown_minutes ?? 0)),
      lastNotifiedAt:
        typeof row?.last_notified_at === 'string' ? row.last_notified_at : null,
    };
  }

  private async getArtistLikeNotificationSettings(
    artistId: string,
  ): Promise<ArtistLikeNotificationSettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('artist_like_notification_settings')
      .select('muted, min_likes_trigger, cooldown_minutes, last_notified_at')
      .eq('user_id', artistId)
      .maybeSingle();

    if (error) {
      if (this.isMissingArtistLikeNotificationSettingsTable(error)) {
        return this.defaultArtistLikeNotificationSettings;
      }
      throw new Error(
        `Failed to load artist like notification settings: ${error.message}`,
      );
    }

    if (!data) {
      return this.defaultArtistLikeNotificationSettings;
    }

    return this.mapArtistLikeNotificationSettings(data);
  }

  private async updateArtistLikeLastNotified(artistId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('artist_like_notification_settings')
      .upsert(
        {
          user_id: artistId,
          last_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error && !this.isMissingArtistLikeNotificationSettingsTable(error)) {
      throw new Error(
        `Failed to update like notification timestamp: ${error.message}`,
      );
    }
  }

  private async maybeNotifyArtistLike(
    likerId: string,
    songId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();

    try {
      const { data: song } = await supabase
        .from('songs')
        .select('id, title, artist_id')
        .eq('id', songId)
        .single();
      if (!song?.artist_id) return;
      if (song.artist_id === likerId) return;

      const settings = await this.getArtistLikeNotificationSettings(
        song.artist_id,
      );
      if (settings.muted) return;

      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', songId);
      const likeCount = count ?? 0;

      if (settings.minLikesTrigger > 1) {
        if (likeCount < settings.minLikesTrigger) return;
        if (likeCount % settings.minLikesTrigger !== 0) return;
      }

      if (settings.cooldownMinutes > 0 && settings.lastNotifiedAt) {
        const elapsedMs =
          Date.now() - new Date(settings.lastNotifiedAt).getTime();
        const cooldownMs = settings.cooldownMinutes * 60 * 1000;
        if (Number.isFinite(elapsedMs) && elapsedMs < cooldownMs) return;
      }

      const { data: liker } = await supabase
        .from('users')
        .select('display_name, email')
        .eq('id', likerId)
        .maybeSingle();
      const likerLabel = liker?.display_name || liker?.email || 'Someone';

      const title = 'New like on your song';
      const message =
        settings.minLikesTrigger > 1
          ? `"${song.title}" reached ${likeCount} likes.`
          : `${likerLabel} liked "${song.title}".`;

      await supabase.from('notifications').insert({
        user_id: song.artist_id,
        type: 'song_liked',
        title,
        message,
        metadata: {
          songId: song.id,
          likerId,
          likeCount,
          minLikesTrigger: settings.minLikesTrigger,
        },
        read: false,
      });

      await this.updateArtistLikeLastNotified(song.artist_id);
    } catch {
      // Best-effort only; like action should not fail if notification fails.
      return;
    }
  }

  private getDiscoverClipDuration(
    start?: number | null,
    end?: number | null,
  ): number {
    if (
      start != null &&
      end != null &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end > start
    ) {
      const computed = Math.round((end - start) * 100) / 100;
      return Math.min(15, Math.max(1, computed));
    }
    return 15;
  }

  private stableHash(input: string): number {
    // FNV-1a 32-bit hash for more stable dispersion than the old bit-shift hash.
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  private createSeededRng(seed: number): () => number {
    // Mulberry32 PRNG: deterministic and fast for shuffle use-cases.
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Deterministic pseudo-random order per user.
   * Keeps pagination stable while still randomizing card order across users.
   */
  private sortDiscoverRowsForUser(
    rows: any[],
    userId: string,
    seed?: string | null,
  ): any[] {
    const seedKey = (seed ?? '').trim() || 'default-seed';
    const list = [...rows];
    if (list.length <= 1) return list;

    const baseSeed = this.stableHash(`${userId}:${seedKey}:${list.length}`);
    const rng = this.createSeededRng(baseSeed);

    // Deterministic Fisher-Yates shuffle (stable pagination for same seed).
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    // Rotate start index so one song doesn't keep sticking to the top.
    const rotateBy =
      this.stableHash(`start:${userId}:${seedKey}`) % list.length;
    if (rotateBy > 0) {
      return list.slice(rotateBy).concat(list.slice(0, rotateBy));
    }
    return list;
  }

  private toDiscoverCard(
    song: any,
    artist: any,
    likeCountBySongId: Map<string, number>,
    likedSongIds: Set<string>,
  ): DiscoverSongCard {
    return {
      songId: song.id,
      artistId: song.artist_id,
      artistName: song.artist_name,
      artistDisplayName: artist?.display_name ?? null,
      artistAvatarUrl: artist?.avatar_url ?? null,
      artistHeadline: artist?.headline ?? null,
      title: song.title,
      clipUrl: song.discover_clip_url,
      backgroundUrl: song.discover_background_url ?? song.artwork_url ?? null,
      clipDurationSeconds: this.getDiscoverClipDuration(
        song.discover_clip_start_seconds,
        song.discover_clip_end_seconds,
      ),
      likeCount: likeCountBySongId.get(song.id) ?? 0,
      likedByMe: likedSongIds.has(song.id),
    };
  }

  private async maybeEmitRisingStarForCurrentPlay(
    songId: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();

    try {
      // rotation_queue position 0 is the current "now playing" state (DB fallback for Redis).
      const { data: rotation } = await supabase
        .from('rotation_queue')
        .select('song_id, played_at')
        .eq('position', 0)
        .single();

      const currentSongIdRaw = rotation?.song_id as string | undefined;
      const playedAtIso = rotation?.played_at as string | undefined;
      if (!currentSongIdRaw || !playedAtIso) return;

      const isAdmin = currentSongIdRaw.startsWith('admin:');
      const currentSongId = currentSongIdRaw.replace(/^admin:|^song:/, '');
      if (isAdmin) return;
      if (currentSongId !== songId) return;

      const playedAtMs = new Date(playedAtIso).getTime();
      if (!Number.isFinite(playedAtMs)) return;
      const lowerIso = new Date(playedAtMs - 5000).toISOString();

      const { data: playRows } = await supabase
        .from('plays')
        .select('id, listener_count, played_at')
        .eq('song_id', songId)
        .gte('played_at', lowerIso)
        .order('played_at', { ascending: false })
        .limit(1);

      const play = (playRows ?? [])[0] as
        | { id: string; listener_count: number | null; played_at: string }
        | undefined;
      if (!play?.id) return;
      const listenersAtStart = play.listener_count ?? 0;
      if (listenersAtStart <= 0) return;

      const { count: likesDuring } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', songId)
        .gte('created_at', playedAtIso);

      const likes = likesDuring ?? 0;
      const conversion = likes / listenersAtStart;
      if (conversion < 0.05) return;

      const { data: song } = await supabase
        .from('songs')
        .select('title, artist_name, artist_id')
        .eq('id', songId)
        .single();

      const payload = {
        type: 'rising_star',
        songId,
        playId: play.id,
        songTitle: song?.title ?? 'A song',
        artistId: song?.artist_id ?? null,
        artistName: song?.artist_name ?? 'An artist',
        likesDuring: likes,
        listenersAtStart,
        conversion,
      };

      const { error } = await supabase.from('station_events').insert({
        station_id: 'global',
        type: 'rising_star',
        play_id: play.id,
        song_id: songId,
        payload,
      });

      if (error) {
        // Unique constraint prevents spam; ignore duplicates.
        if (error.code === '23505') return;
      }
    } catch {
      // Best-effort only; never break liking.
      return;
    }
  }

  async createSong(userId: string, createSongDto: CreateSongDto) {
    const supabase = getSupabaseClient();

    // Any authenticated app role can upload songs.
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (
      !user ||
      !['listener', 'artist', 'service_provider', 'admin'].includes(user.role)
    ) {
      throw new ForbiddenException('Your account role cannot upload songs');
    }

    const discoverStartRaw = createSongDto.discoverClipStartSeconds;
    const discoverEndRaw = createSongDto.discoverClipEndSeconds;
    let discoverClipUrl = createSongDto.discoverClipUrl ?? null;
    let discoverEnabled = !!discoverClipUrl;
    const discoverClipStartSeconds =
      discoverStartRaw != null ? Number(discoverStartRaw) : null;
    const discoverClipEndSeconds =
      discoverEndRaw != null ? Number(discoverEndRaw) : null;

    const hasTrimRange =
      discoverClipStartSeconds != null &&
      discoverClipEndSeconds != null &&
      Number.isFinite(discoverClipStartSeconds) &&
      Number.isFinite(discoverClipEndSeconds);

    if (hasTrimRange) {
      if (
        discoverClipStartSeconds < 0 ||
        discoverClipEndSeconds <= discoverClipStartSeconds
      ) {
        throw new BadRequestException(
          'Discover clip trim range must be valid and end must be greater than start',
        );
      }
      if (
        discoverClipEndSeconds - discoverClipStartSeconds >
        this.discoverMaxClipSeconds
      ) {
        throw new BadRequestException(
          `Discover clip trim range must be ${this.discoverMaxClipSeconds} seconds or less`,
        );
      }

      // Admin-style server trim: render a separate discover clip file.
      const trimSourceUrl = discoverClipUrl ?? createSongDto.audioUrl;
      discoverClipUrl = await this.createTrimmedDiscoverClip({
        sourceUrl: trimSourceUrl,
        artistId: userId,
        songKey: createSongDto.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        startSeconds: discoverClipStartSeconds,
        endSeconds: discoverClipEndSeconds,
      });
      discoverEnabled = true;
    } else if (discoverStartRaw != null || discoverEndRaw != null) {
      throw new BadRequestException(
        'Provide both discover clip start and end seconds to trim',
      );
    }

    const baseInsertPayload = {
      artist_id: userId,
      title: createSongDto.title,
      artist_name: createSongDto.artistName,
      artist_origin_city: createSongDto.artistOriginCity,
      artist_origin_state: createSongDto.artistOriginState,
      audio_url: createSongDto.audioUrl,
      artwork_url: createSongDto.artworkUrl,
      duration_seconds: createSongDto.durationSeconds || 180, // Default 3 min if not provided
      station_id: createSongDto.stationId,
      status: 'pending',
    };
    const legacyBaseInsertPayload = {
      artist_id: userId,
      title: createSongDto.title,
      artist_name: createSongDto.artistName,
      audio_url: createSongDto.audioUrl,
      artwork_url: createSongDto.artworkUrl,
      duration_seconds: createSongDto.durationSeconds || 180,
      station_id: createSongDto.stationId,
      status: 'pending',
    };

    const discoverInsertPayload = {
      ...baseInsertPayload,
      discover_enabled: discoverEnabled,
      discover_clip_url: discoverClipUrl,
      discover_background_url: createSongDto.discoverBackgroundUrl ?? null,
      discover_clip_start_seconds: discoverClipStartSeconds,
      discover_clip_end_seconds: discoverClipEndSeconds,
      discover_clip_duration_seconds: this.getDiscoverClipDuration(
        discoverClipStartSeconds,
        discoverClipEndSeconds,
      ),
    };
    const legacyDiscoverInsertPayload = {
      ...legacyBaseInsertPayload,
      discover_enabled: discoverEnabled,
      discover_clip_url: discoverClipUrl,
      discover_background_url: createSongDto.discoverBackgroundUrl ?? null,
      discover_clip_start_seconds: discoverClipStartSeconds,
      discover_clip_end_seconds: discoverClipEndSeconds,
      discover_clip_duration_seconds: this.getDiscoverClipDuration(
        discoverClipStartSeconds,
        discoverClipEndSeconds,
      ),
    };

    let insertRes = await supabase
      .from('songs')
      .insert(discoverInsertPayload)
      .select()
      .single();

    // Backward-compatible fallback when production DB has not applied Discover migration.
    if (
      insertRes.error &&
      this.isMissingAnyColumnError(insertRes.error, [
        'discover_enabled',
        'discover_clip_url',
        'discover_background_url',
        'discover_clip_start_seconds',
        'discover_clip_end_seconds',
        'discover_clip_duration_seconds',
      ])
    ) {
      insertRes = await supabase
        .from('songs')
        .insert(baseInsertPayload)
        .select()
        .single();
    }

    // Backward-compatible fallback when production DB has not applied artist origin migration.
    if (
      insertRes.error &&
      this.isMissingAnyColumnError(insertRes.error, [
        'artist_origin_city',
        'artist_origin_state',
      ])
    ) {
      const payloadWithoutOrigin = this.isMissingAnyColumnError(
        insertRes.error,
        [
          'discover_enabled',
          'discover_clip_url',
          'discover_background_url',
          'discover_clip_start_seconds',
          'discover_clip_end_seconds',
          'discover_clip_duration_seconds',
        ],
      )
        ? legacyBaseInsertPayload
        : legacyDiscoverInsertPayload;
      insertRes = await supabase
        .from('songs')
        .insert(payloadWithoutOrigin)
        .select()
        .single();
    }

    if (insertRes.error) {
      throw new Error(`Failed to create song: ${insertRes.error.message}`);
    }

    return insertRes.data;
  }

  async publishSongToDiscover(
    requesterUserId: string,
    requesterRole: string | null | undefined,
    songId: string,
    params: {
      clipStartSeconds: number;
      clipEndSeconds: number;
      discoverBackgroundUrl?: string;
    },
  ) {
    const supabase = getSupabaseClient();
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, artist_id, title, audio_url, artwork_url')
      .eq('id', songId)
      .single();
    if (songError || !song) {
      throw new NotFoundException('Song not found');
    }
    const isAdmin = requesterRole === 'admin';
    if (!isAdmin && song.artist_id !== requesterUserId) {
      throw new ForbiddenException(
        'You can only publish songs from your own library',
      );
    }
    if (!song.audio_url) {
      throw new BadRequestException('Song has no audio source');
    }

    const start = Number(params.clipStartSeconds);
    const end = Number(params.clipEndSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new BadRequestException(
        'clipStartSeconds and clipEndSeconds must be valid and end must be greater than start',
      );
    }
    if (start < 0 || end - start > this.discoverMaxClipSeconds) {
      throw new BadRequestException(
        `Discover clip range must be between 0 and ${this.discoverMaxClipSeconds} seconds`,
      );
    }

    const discoverClipUrl = await this.createTrimmedDiscoverClip({
      sourceUrl: song.audio_url,
      artistId: song.artist_id,
      songKey: song.id,
      startSeconds: start,
      endSeconds: end,
    });
    const discoverBackgroundUrl =
      params.discoverBackgroundUrl?.trim() || song.artwork_url || null;
    const clipDuration = Math.round((end - start) * 100) / 100;

    const { data: updated, error: updateError } = await supabase
      .from('songs')
      .update({
        discover_enabled: true,
        discover_clip_url: discoverClipUrl,
        discover_background_url: discoverBackgroundUrl,
        discover_clip_start_seconds: start,
        discover_clip_end_seconds: end,
        discover_clip_duration_seconds: clipDuration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', songId)
      .select(
        'id, title, discover_enabled, discover_clip_url, discover_background_url, discover_clip_start_seconds, discover_clip_end_seconds, discover_clip_duration_seconds',
      )
      .single();
    if (updateError) {
      throw new BadRequestException(
        `Failed to publish discover clip: ${updateError.message}`,
      );
    }

    return {
      id: updated.id,
      title: updated.title,
      discoverEnabled: updated.discover_enabled ?? false,
      discoverClipUrl: updated.discover_clip_url ?? null,
      discoverBackgroundUrl: updated.discover_background_url ?? null,
      discoverClipStartSeconds: updated.discover_clip_start_seconds ?? null,
      discoverClipEndSeconds: updated.discover_clip_end_seconds ?? null,
      discoverClipDurationSeconds:
        updated.discover_clip_duration_seconds ?? null,
    };
  }

  async getSongById(songId: string) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Song not found');
    }

    return data;
  }

  async getSongs(filters: {
    artistId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const supabase = getSupabaseClient();
    let query = supabase.from('songs').select('*');

    if (filters.artistId) {
      query = query.eq('artist_id', filters.artistId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 20) - 1,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }

    return data;
  }

  async getDiscoverFeed(
    userId: string,
    limitInput = 12,
    cursor?: string,
    seed?: string,
  ): Promise<DiscoverFeedResponse> {
    const supabase = getSupabaseClient();
    const limit = Math.min(Math.max(1, limitInput), 30);
    const offset = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
    const maxPool = 3000;

    const swipesRes = await supabase
      .from('discover_swipes')
      .select('song_id')
      .eq('user_id', userId);
    if (
      swipesRes.error &&
      !this.isMissingTableError(swipesRes.error, 'discover_swipes')
    ) {
      throw new Error(
        `Failed to load discover swipes: ${swipesRes.error.message}`,
      );
    }
    const swipes = (swipesRes.data || []) as Array<{ song_id: string }>;
    const swipedSongIds = new Set<string>((swipes || []).map((r) => r.song_id));

    let rows: any[] = [];
    const songsDiscoverRes = await supabase
      .from('songs')
      .select(
        'id, artist_id, artist_name, title, artwork_url, discover_clip_url, discover_background_url, discover_clip_start_seconds, discover_clip_end_seconds, discover_enabled, status, created_at',
      )
      .eq('status', 'approved')
      .eq('discover_enabled', true)
      .not('discover_clip_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, maxPool - 1);
    if (songsDiscoverRes.error) {
      if (
        this.isMissingAnyColumnError(songsDiscoverRes.error, [
          'discover_enabled',
          'discover_clip_url',
          'discover_background_url',
          'discover_clip_start_seconds',
          'discover_clip_end_seconds',
        ])
      ) {
        const songsLegacyRes = await supabase
          .from('songs')
          .select(
            'id, artist_id, artist_name, title, artwork_url, audio_url, status, created_at',
          )
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .range(0, maxPool - 1);
        if (songsLegacyRes.error) {
          throw new Error(
            `Failed to load discover feed: ${songsLegacyRes.error.message}`,
          );
        }
        rows = (songsLegacyRes.data || []).map((song: any) => ({
          ...song,
          discover_enabled: true,
          discover_clip_url: song.audio_url ?? null,
          discover_background_url: song.artwork_url ?? null,
          discover_clip_start_seconds: null,
          discover_clip_end_seconds: null,
        }));
      } else {
        throw new Error(
          `Failed to load discover feed: ${songsDiscoverRes.error.message}`,
        );
      }
    } else {
      rows = songsDiscoverRes.data || [];
    }

    const filtered = (rows || []).filter(
      (row: any) => !swipedSongIds.has(row.id),
    );
    const randomizedRows = this.sortDiscoverRowsForUser(filtered, userId, seed);
    const pageRows = randomizedRows.slice(offset, offset + limit);

    const songIds = pageRows.map((r: any) => r.id);
    const artistIds = [...new Set(pageRows.map((r: any) => r.artist_id))];

    const [artistsRawRes, likesRawRes, myLikesRawRes] = await Promise.all([
      artistIds.length > 0
        ? supabase
            .from('users')
            .select('id, display_name, avatar_url, headline')
            .in('id', artistIds)
        : Promise.resolve({ data: [] as any[] }),
      songIds.length > 0
        ? supabase
            .from('discover_song_likes')
            .select('song_id')
            .in('song_id', songIds)
        : Promise.resolve({ data: [] as any[] }),
      songIds.length > 0
        ? supabase
            .from('discover_song_likes')
            .select('song_id')
            .eq('user_id', userId)
            .in('song_id', songIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let artistsData = artistsRawRes.data || [];
    if ((artistsRawRes as any).error) {
      if (
        this.isMissingAnyColumnError((artistsRawRes as any).error, [
          'headline',
          'avatar_url',
          'display_name',
        ])
      ) {
        const artistsLegacyRes = artistIds.length
          ? await supabase
              .from('users')
              .select('id, display_name')
              .in('id', artistIds)
          : ({ data: [] as any[], error: null } as any);
        if (artistsLegacyRes.error) {
          throw new Error(
            `Failed to load discover artists: ${artistsLegacyRes.error.message}`,
          );
        }
        artistsData = artistsLegacyRes.data || [];
      } else {
        throw new Error(
          `Failed to load discover artists: ${(artistsRawRes as any).error.message}`,
        );
      }
    }

    const likesError = (likesRawRes as any).error;
    const myLikesError = (myLikesRawRes as any).error;
    const discoverLikesTableMissing =
      this.isMissingTableError(likesError, 'discover_song_likes') ||
      this.isMissingTableError(myLikesError, 'discover_song_likes');

    if (
      (likesError && !discoverLikesTableMissing) ||
      (myLikesError && !discoverLikesTableMissing)
    ) {
      const errMessage = likesError?.message || myLikesError?.message;
      throw new Error(`Failed to load discover likes: ${errMessage}`);
    }

    let likesData: any[] = [];
    let myLikesData: any[] = [];
    if (discoverLikesTableMissing) {
      const [likesFallbackRes, myLikesFallbackRes] = await Promise.all([
        songIds.length > 0
          ? supabase.from('likes').select('song_id').in('song_id', songIds)
          : Promise.resolve({ data: [] as any[], error: null } as any),
        songIds.length > 0
          ? supabase
              .from('likes')
              .select('song_id')
              .eq('user_id', userId)
              .in('song_id', songIds)
          : Promise.resolve({ data: [] as any[], error: null } as any),
      ]);
      if (likesFallbackRes.error || myLikesFallbackRes.error) {
        throw new Error(
          `Failed to load discover likes fallback: ${
            likesFallbackRes.error?.message || myLikesFallbackRes.error?.message
          }`,
        );
      }
      likesData = (likesFallbackRes.data || []) as any[];
      myLikesData = (myLikesFallbackRes.data || []) as any[];
    } else {
      likesData = likesRawRes.data || [];
      myLikesData = myLikesRawRes.data || [];
    }

    const artistById = new Map(artistsData.map((u: any) => [u.id, u]));
    const likeCountBySongId = new Map<string, number>();
    for (const row of likesData) {
      const songId = row.song_id as string;
      likeCountBySongId.set(songId, (likeCountBySongId.get(songId) ?? 0) + 1);
    }
    const likedSongIds = new Set<string>(
      myLikesData.map((row: any) => row.song_id as string),
    );

    const items = pageRows.map((song: any) =>
      this.toDiscoverCard(
        song,
        artistById.get(song.artist_id),
        likeCountBySongId,
        likedSongIds,
      ),
    );

    const nextCursor =
      randomizedRows.length > offset + limit ? String(offset + limit) : null;
    return { items, nextCursor };
  }

  async swipeDiscoverSong(
    userId: string,
    params: {
      songId: string;
      direction: 'left_skip' | 'right_like';
      decisionMs?: number;
    },
  ): Promise<{ direction: 'left_skip' | 'right_like'; liked: boolean }> {
    const supabase = getSupabaseClient();
    const songDiscoverRes = await supabase
      .from('songs')
      .select('id, artist_id, status, discover_enabled, discover_clip_url')
      .eq('id', params.songId)
      .single();
    let song: any = songDiscoverRes.data;
    let songError: any = songDiscoverRes.error;

    // Backward-compatible fallback if discover columns are not yet deployed.
    if (
      songError &&
      this.isMissingAnyColumnError(songError, [
        'discover_enabled',
        'discover_clip_url',
      ])
    ) {
      const songLegacyRes = await supabase
        .from('songs')
        .select('id, artist_id, status, audio_url')
        .eq('id', params.songId)
        .single();
      song = songLegacyRes.data
        ? {
            ...songLegacyRes.data,
            discover_enabled: true,
            discover_clip_url: (songLegacyRes.data as any).audio_url ?? null,
          }
        : null;
      songError = songLegacyRes.error;
    }

    if (songError || !song) throw new NotFoundException('Song not found');
    if (
      song.status !== 'approved' ||
      !song.discover_enabled ||
      !song.discover_clip_url
    ) {
      throw new ForbiddenException('Song is not available for Discover');
    }

    const decisionMs =
      params.decisionMs != null && Number.isFinite(params.decisionMs)
        ? Math.max(0, Math.min(params.decisionMs, 5 * 60 * 1000))
        : null;

    const { error: swipeError } = await supabase.from('discover_swipes').upsert(
      {
        user_id: userId,
        song_id: params.songId,
        artist_id: song.artist_id,
        direction: params.direction,
        decision_ms: decisionMs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,song_id' },
    );
    if (
      swipeError &&
      !this.isMissingTableError(swipeError, 'discover_swipes')
    ) {
      throw new Error(`Failed to record swipe: ${swipeError.message}`);
    }

    if (params.direction === 'right_like') {
      const { error: likeError } = await supabase
        .from('discover_song_likes')
        .upsert(
          {
            user_id: userId,
            song_id: params.songId,
            artist_id: song.artist_id,
          },
          { onConflict: 'user_id,song_id' },
        );
      if (
        likeError &&
        this.isMissingTableError(likeError, 'discover_song_likes')
      ) {
        await this.upsertCoreLikeWithFallback(
          userId,
          params.songId,
          song.artist_id,
        );
      } else if (likeError) {
        throw new Error(`Failed to save discover like: ${likeError.message}`);
      }
      return { direction: params.direction, liked: true };
    }

    await this.removeDiscoverLike(userId, params.songId);
    return { direction: params.direction, liked: false };
  }

  async removeDiscoverLike(userId: string, songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error: unlikeError } = await supabase
      .from('discover_song_likes')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (
      unlikeError &&
      this.isMissingTableError(unlikeError, 'discover_song_likes')
    ) {
      const { error: fallbackUnlikeError } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('song_id', songId);
      if (fallbackUnlikeError) {
        throw new Error(
          `Failed to remove discover like fallback: ${fallbackUnlikeError.message}`,
        );
      }
    } else if (unlikeError) {
      throw new Error(`Failed to remove discover like: ${unlikeError.message}`);
    }
  }

  async clearDiscoverLikedList(userId: string): Promise<{ removed: number }> {
    const supabase = getSupabaseClient();
    const { data: rows, error: likesError } = await supabase
      .from('discover_song_likes')
      .select('song_id')
      .eq('user_id', userId);

    if (
      likesError &&
      !this.isMissingTableError(likesError, 'discover_song_likes')
    ) {
      throw new Error(
        `Failed to load discover likes for clear: ${likesError.message}`,
      );
    }

    if (this.isMissingTableError(likesError, 'discover_song_likes')) {
      const { data: fallbackRows, error: fallbackLoadError } = await supabase
        .from('likes')
        .select('song_id')
        .eq('user_id', userId);
      if (fallbackLoadError) {
        throw new Error(
          `Failed to load discover likes fallback for clear: ${fallbackLoadError.message}`,
        );
      }

      const { error: fallbackDeleteError } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId);
      if (fallbackDeleteError) {
        throw new Error(
          `Failed to clear discover likes fallback: ${fallbackDeleteError.message}`,
        );
      }
      return { removed: (fallbackRows || []).length };
    }

    const { error: deleteError } = await supabase
      .from('discover_song_likes')
      .delete()
      .eq('user_id', userId);
    if (deleteError) {
      throw new Error(`Failed to clear discover likes: ${deleteError.message}`);
    }
    return { removed: (rows || []).length };
  }

  async removeDiscoverSwipe(userId: string, songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('discover_swipes')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (error && !this.isMissingTableError(error, 'discover_swipes')) {
      throw new Error(`Failed to remove discover swipe: ${error.message}`);
    }
  }

  async clearDiscoverSwipes(userId: string): Promise<{ removed: number }> {
    const supabase = getSupabaseClient();
    const { data: rows, error: listError } = await supabase
      .from('discover_swipes')
      .select('song_id')
      .eq('user_id', userId);

    if (listError) {
      if (this.isMissingTableError(listError, 'discover_swipes')) {
        return { removed: 0 };
      }
      throw new Error(
        `Failed to load discover swipes for clear: ${listError.message}`,
      );
    }

    const { error: deleteError } = await supabase
      .from('discover_swipes')
      .delete()
      .eq('user_id', userId);
    if (
      deleteError &&
      !this.isMissingTableError(deleteError, 'discover_swipes')
    ) {
      throw new Error(
        `Failed to clear discover swipes: ${deleteError.message}`,
      );
    }

    return { removed: (rows || []).length };
  }

  async getDiscoverLikedList(
    userId: string,
    limitInput = 50,
    offsetInput = 0,
  ): Promise<{ items: DiscoverLikedListItem[]; total: number }> {
    const supabase = getSupabaseClient();
    const limit = Math.min(Math.max(1, limitInput), 100);
    const offset = Math.max(0, offsetInput);

    let likes: Array<{
      song_id: string;
      created_at?: string | null;
      liked_at?: string | null;
    }> | null = null;
    let count: number | null = null;

    const likesCreatedAtRes = await supabase
      .from('discover_song_likes')
      .select('song_id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (likesCreatedAtRes.error) {
      if (
        this.isMissingTableError(likesCreatedAtRes.error, 'discover_song_likes')
      ) {
        const likesFallbackRes = await supabase
          .from('likes')
          .select('song_id, created_at', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (likesFallbackRes.error) {
          throw new Error(
            `Failed to load discover likes fallback: ${likesFallbackRes.error.message}`,
          );
        }
        likes = (likesFallbackRes.data || []) as Array<{
          song_id: string;
          created_at?: string | null;
        }>;
        count = likesFallbackRes.count ?? null;
      } else if (
        this.isMissingColumnError(likesCreatedAtRes.error, 'created_at')
      ) {
        const likesLegacyRes = await supabase
          .from('discover_song_likes')
          .select('song_id, liked_at', { count: 'exact' })
          .eq('user_id', userId)
          .order('liked_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (likesLegacyRes.error) {
          throw new Error(
            `Failed to load discover likes: ${likesLegacyRes.error.message}`,
          );
        }
        likes = (likesLegacyRes.data || []) as Array<{
          song_id: string;
          liked_at?: string | null;
        }>;
        count = likesLegacyRes.count ?? null;
      } else {
        throw new Error(
          `Failed to load discover likes: ${likesCreatedAtRes.error.message}`,
        );
      }
    } else {
      likes = (likesCreatedAtRes.data || []) as Array<{
        song_id: string;
        created_at?: string | null;
      }>;
      count = likesCreatedAtRes.count ?? null;
    }

    if (!likes?.length) return { items: [], total: count ?? 0 };

    const songIds = likes.map((l) => l.song_id);
    const likedAtBySongId = new Map(
      likes.map((l) => [
        l.song_id,
        l.created_at ?? l.liked_at ?? new Date().toISOString(),
      ]),
    );

    let songs: any[] = [];
    const songsDiscoverRes = await supabase
      .from('songs')
      .select(
        'id, artist_id, artist_name, title, artwork_url, discover_clip_url, discover_background_url, discover_clip_start_seconds, discover_clip_end_seconds, discover_enabled, status',
      )
      .in('id', songIds)
      .eq('status', 'approved')
      .eq('discover_enabled', true)
      .not('discover_clip_url', 'is', null);
    if (songsDiscoverRes.error) {
      if (
        this.isMissingAnyColumnError(songsDiscoverRes.error, [
          'discover_enabled',
          'discover_clip_url',
          'discover_background_url',
          'discover_clip_start_seconds',
          'discover_clip_end_seconds',
        ])
      ) {
        // Schema fallback for partially migrated environments.
        const songsLegacyRes = await supabase
          .from('songs')
          .select(
            'id, artist_id, artist_name, title, artwork_url, audio_url, status',
          )
          .in('id', songIds)
          .eq('status', 'approved');
        if (songsLegacyRes.error) {
          throw new Error(
            `Failed to load discover songs: ${songsLegacyRes.error.message}`,
          );
        }
        songs = (songsLegacyRes.data || []).map((song) => ({
          ...song,
          discover_enabled: true,
          discover_clip_url: (song as any).audio_url ?? null,
          discover_background_url: (song as any).artwork_url ?? null,
          discover_clip_start_seconds: null,
          discover_clip_end_seconds: null,
        }));
      } else {
        throw new Error(
          `Failed to load discover songs: ${songsDiscoverRes.error.message}`,
        );
      }
    } else {
      songs = songsDiscoverRes.data || [];
    }

    const artistIds = [
      ...new Set((songs || []).map((s: any) => s.artist_id as string)),
    ];
    const [artistsRawRes, likeCountsRes] = await Promise.all([
      artistIds.length > 0
        ? supabase
            .from('users')
            .select('id, display_name, avatar_url, headline')
            .in('id', artistIds)
        : Promise.resolve({ data: [] as any[], error: null } as any),
      songIds.length > 0
        ? supabase
            .from('discover_song_likes')
            .select('song_id')
            .in('song_id', songIds)
        : Promise.resolve({ data: [] as any[], error: null } as any),
    ]);

    let artistsRes = artistsRawRes;
    if (artistsRawRes?.error) {
      if (
        this.isMissingAnyColumnError(artistsRawRes.error, [
          'headline',
          'avatar_url',
          'display_name',
        ])
      ) {
        const artistsLegacyRes = artistIds.length
          ? await supabase
              .from('users')
              .select('id, display_name')
              .in('id', artistIds)
          : ({ data: [] as any[], error: null } as any);
        if (artistsLegacyRes.error) {
          throw new Error(
            `Failed to load discover artists: ${artistsLegacyRes.error.message}`,
          );
        }
        artistsRes = artistsLegacyRes;
      } else {
        throw new Error(
          `Failed to load discover artists: ${artistsRawRes.error.message}`,
        );
      }
    }

    const artistById = new Map(
      (artistsRes.data || []).map((u: any) => [u.id, u]),
    );
    const likeCountBySongId = new Map<string, number>();
    for (const row of likeCountsRes.data || []) {
      const id = row.song_id as string;
      likeCountBySongId.set(id, (likeCountBySongId.get(id) ?? 0) + 1);
    }
    const likedSongIds = new Set(songIds);
    const songById = new Map((songs || []).map((s: any) => [s.id, s]));

    const ordered = songIds
      .map((songId) => songById.get(songId))
      .filter(Boolean)
      .map((song: any) => ({
        ...this.toDiscoverCard(
          song,
          artistById.get(song.artist_id),
          likeCountBySongId,
          likedSongIds,
        ),
        likedAt: likedAtBySongId.get(song.id) ?? new Date().toISOString(),
      }));

    return { items: ordered, total: count ?? ordered.length };
  }

  async likeSong(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Check if already liked
    const { data: existingLike, error: existingLikeError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .maybeSingle();

    if (existingLikeError) {
      throw new Error(
        `Failed to check like status: ${existingLikeError.message}`,
      );
    }

    if (existingLike) {
      // Already liked, return current status
      return { liked: true };
    }

    // Like
    const { error: insertError } = await supabase.from('likes').insert({
      user_id: userId,
      song_id: songId,
    });
    if (insertError) {
      if (insertError.code === '23505') {
        return { liked: true };
      }
      throw new Error(`Failed to save song to library: ${insertError.message}`);
    }
    await this.maybeNotifyArtistLike(userId, songId);
    return { liked: true };
  }

  async unlikeSong(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Delete like if it exists
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('song_id', songId);
    if (error) {
      throw new Error(`Failed to remove saved song: ${error.message}`);
    }

    return { liked: false };
  }

  async isLiked(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .single();

    return { liked: !!existingLike };
  }

  async getLibrarySongs(userId: string) {
    const supabase = getSupabaseClient();

    const { data: likesRows, error: likesError } = await supabase
      .from('likes')
      .select('song_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (likesError) {
      throw new Error(`Failed to load library songs: ${likesError.message}`);
    }

    type SongRow = {
      id: string;
      title: string;
      artist_name: string;
      artist_id: string;
      artwork_url: string | null;
      audio_url: string | null;
      duration_seconds: number | null;
      like_count: number | null;
      play_count: number | null;
      status: string | null;
    };

    const rows = (likesRows ?? []) as Array<{
      song_id: string;
      created_at: string | null;
    }>;

    const likedAtBySongId = new Map<string, string>();
    for (const row of rows) {
      if (!likedAtBySongId.has(row.song_id)) {
        likedAtBySongId.set(
          row.song_id,
          row.created_at ?? new Date().toISOString(),
        );
      }
    }
    const orderedSongIds = rows.map((r) => r.song_id);
    const uniqueSongIds = [...new Set(orderedSongIds)];

    const songsById = new Map<string, SongRow>();
    const adminFallbackById = new Map<
      string,
      {
        id: string;
        title: string;
        artist_name: string | null;
        artwork_url: string | null;
        audio_url: string | null;
        duration_seconds: number | null;
      }
    >();
    if (uniqueSongIds.length > 0) {
      const { data: songRows, error: songsError } = await supabase
        .from('songs')
        .select(
          'id, title, artist_name, artist_id, artwork_url, audio_url, duration_seconds, like_count, play_count, status',
        )
        .in('id', uniqueSongIds);
      if (songsError) {
        throw new Error(`Failed to load library songs: ${songsError.message}`);
      }
      for (const song of (songRows ?? []) as SongRow[]) {
        songsById.set(song.id, song);
      }

      const { data: adminFallbackRows, error: adminFallbackError } =
        await supabase
          .from('admin_fallback_songs')
          .select(
            'id, title, artist_name, artwork_url, audio_url, duration_seconds',
          )
          .in('id', uniqueSongIds);
      if (adminFallbackError) {
        throw new Error(
          `Failed to load fallback library songs: ${adminFallbackError.message}`,
        );
      }
      for (const row of (adminFallbackRows ?? []) as Array<{
        id: string;
        title: string;
        artist_name: string | null;
        artwork_url: string | null;
        audio_url: string | null;
        duration_seconds: number | null;
      }>) {
        adminFallbackById.set(row.id, row);
      }
    }

    const librarySongs = rows
      .map((r) => {
        const song = songsById.get(r.song_id) ?? null;
        const fallback = adminFallbackById.get(r.song_id) ?? null;
        if (song && song.status !== 'approved') return null;
        if (!song && !fallback) return null;
        return {
          id: song?.id ?? fallback!.id,
          title: song?.title ?? fallback!.title,
          artistName:
            song?.artist_name ?? fallback?.artist_name ?? 'Unknown artist',
          artistId: song?.artist_id ?? '',
          artworkUrl: song?.artwork_url ?? fallback?.artwork_url ?? null,
          audioUrl: song?.audio_url ?? fallback?.audio_url ?? null,
          durationSeconds:
            song?.duration_seconds ?? fallback?.duration_seconds ?? 180,
          likeCount: song?.like_count ?? 0,
          playCount: song?.play_count ?? 0,
          likedAt:
            likedAtBySongId.get(song?.id ?? fallback!.id) ??
            new Date().toISOString(),
        };
      })
      .filter((song): song is NonNullable<typeof song> => song !== null);

    const songIds = [...new Set(librarySongs.map((s) => s.id))];
    const likeCountsBySongId = new Map<string, number>();
    const fireVotesBySongId = new Map<string, number>();
    const shitVotesBySongId = new Map<string, number>();

    if (songIds.length > 0) {
      const { data: likeRows, error: likesCountError } = await supabase
        .from('likes')
        .select('song_id')
        .in('song_id', songIds);
      if (likesCountError) {
        throw new Error(
          `Failed to load library like counts: ${likesCountError.message}`,
        );
      }
      for (const row of (likeRows ?? []) as Array<{ song_id: string }>) {
        likeCountsBySongId.set(
          row.song_id,
          (likeCountsBySongId.get(row.song_id) ?? 0) + 1,
        );
      }

      const { data: reactionsRows, error: reactionsError } = await supabase
        .from('leaderboard_likes')
        .select('song_id, reaction')
        .in('song_id', songIds);
      if (reactionsError) {
        throw new Error(
          `Failed to load song temperatures: ${reactionsError.message}`,
        );
      }
      for (const row of (reactionsRows ?? []) as Array<{
        song_id: string;
        reaction: string | null;
      }>) {
        if (row.reaction === 'shit') {
          shitVotesBySongId.set(
            row.song_id,
            (shitVotesBySongId.get(row.song_id) ?? 0) + 1,
          );
        } else {
          fireVotesBySongId.set(
            row.song_id,
            (fireVotesBySongId.get(row.song_id) ?? 0) + 1,
          );
        }
      }
    }

    return librarySongs.map((song) => {
      const fireVotes = fireVotesBySongId.get(song.id) ?? 0;
      const shitVotes = shitVotesBySongId.get(song.id) ?? 0;
      const totalVotes = fireVotes + shitVotes;
      return {
        ...song,
        likeCount: likeCountsBySongId.get(song.id) ?? song.likeCount,
        fireVotes,
        shitVotes,
        temperaturePercent:
          totalVotes > 0 ? Math.round((fireVotes / totalVotes) * 100) : 50,
      };
    });
  }

  async toggleLike(userId: string, songId: string) {
    const supabase = getSupabaseClient();

    // Check if already liked
    const { data: existingLike, error: existingLikeError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .maybeSingle();

    if (existingLikeError) {
      throw new Error(
        `Failed to check like status: ${existingLikeError.message}`,
      );
    }

    if (existingLike) {
      // Unlike
      const { error: unlikeError } = await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      if (unlikeError) {
        throw new Error(`Failed to remove saved song: ${unlikeError.message}`);
      }
      return { liked: false };
    } else {
      // Like
      const { error: likeError } = await supabase.from('likes').insert({
        user_id: userId,
        song_id: songId,
      });
      if (likeError) {
        if (likeError.code === '23505') {
          return { liked: true };
        }
        throw new Error(`Failed to save song to library: ${likeError.message}`);
      }
      await this.maybeNotifyArtistLike(userId, songId);
      return { liked: true };
    }
  }

  async recordProfileListen(
    songId: string,
    userId: string | null,
  ): Promise<{ recorded: true }> {
    const supabase = getSupabaseClient();

    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, artist_id, status')
      .eq('id', songId)
      .single();

    if (songErr || !song) {
      throw new NotFoundException('Song not found');
    }
    if ((song as any).status !== 'approved') {
      throw new ForbiddenException('Song is not available');
    }

    const { error } = await supabase.from('song_profile_listens').insert({
      song_id: songId,
      artist_id: (song as any).artist_id,
      user_id: userId,
    });
    if (error) {
      throw new Error(`Failed to record profile listen: ${error.message}`);
    }
    return { recorded: true };
  }
}
