import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  Headers,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SongsService } from './songs.service';
import { UploadsService } from '../uploads/uploads.service';
import { DurationService } from '../uploads/duration.service';
import { CreateSongDto } from './dto/create-song.dto';
import { CreateSongFromPathDto } from './dto/create-song-from-path.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { signSongAudioUrl } from '../common/song-audio.util';
import { generateUniqueUsername } from '../common/username.util';
import { getFirebaseAuth } from '../config/firebase.config';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { STATION_IDS } from '../radio/station.constants';
import { AdminService } from '../admin/admin.service';
import { ImageModerationService } from '../moderation/image-moderation.service';
import { LyricsService } from '../lyrics/lyrics.service';

@Controller('songs')
export class SongsController {
  private readonly logger = new Logger(SongsController.name);

  constructor(
    private readonly songsService: SongsService,
    private readonly uploadsService: UploadsService,
    private readonly durationService: DurationService,
    private readonly adminService: AdminService,
    private readonly imageModeration: ImageModerationService,
    private readonly lyricsService: LyricsService,
  ) {}

  private assertArtistProfileComplete(userData: {
    display_name?: string | null;
  }) {
    const artistName = (userData.display_name ?? '').trim();
    if (!artistName) {
      throw new BadRequestException(
        'Artist name is required. Please set your profile display name before uploading songs.',
      );
    }
  }

  /**
   * Resolve the backend user row for an authenticated Firebase user, creating a
   * minimal row on the fly if it does not exist yet. This prevents brand-new
   * accounts from hitting "User not found" when their profile row has not been
   * provisioned yet (e.g. uploading immediately after sign-up, before the
   * background bootstrap has finished).
   */
  private async resolveUploaderUser(user: FirebaseUser): Promise<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }> {
    const supabase = getSupabaseClient();
    const select = () =>
      supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .eq('firebase_uid', user.uid)
        .maybeSingle();

    const { data: existing } = await select();
    if (existing) {
      return existing as {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
      };
    }

    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new NotFoundException('User not found');
    }

    const username = await generateUniqueUsername(supabase, {
      email,
      userId: user.uid,
    });
    const { error: insertError } = await supabase.from('users').insert({
      firebase_uid: user.uid,
      email,
      username,
      role: 'listener',
    });
    // 23505 = row was created concurrently; fall through to re-select.
    if (insertError && insertError.code !== '23505') {
      this.logger.warn(
        `Failed to provision user row for ${user.uid}: ${insertError.message}`,
      );
    }

    const { data: created } = await select();
    if (!created) {
      throw new NotFoundException('User not found');
    }
    return created as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42703') {
      return message.includes(columnName.toLowerCase());
    }
    if (maybe?.code === 'PGRST204') {
      return (
        message.includes(`'${columnName.toLowerCase()}'`) ||
        message.includes(columnName.toLowerCase())
      );
    }
    return false;
  }

  private isMissingAnyDiscoverColumnError(error: unknown): boolean {
    const discoverColumns = [
      'discover_enabled',
      'discover_clip_url',
      'discover_background_url',
      'discover_clip_start_seconds',
      'discover_clip_end_seconds',
      'discover_clip_duration_seconds',
    ];
    return discoverColumns.some((column) =>
      this.isMissingColumnError(error, column),
    );
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    const maybe = error as { code?: string; message?: string } | null;
    const message = (maybe?.message ?? '').toLowerCase();
    if (maybe?.code === '42P01') {
      return message.includes(tableName.toLowerCase());
    }
    if (maybe?.code === 'PGRST205') {
      return (
        message.includes(`'${tableName.toLowerCase()}'`) ||
        message.includes(tableName.toLowerCase())
      );
    }
    return false;
  }

  private async getFeaturedArtistsBySongIds(songIds: string[]): Promise<
    Map<
      string,
      Array<{
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>
    >
  > {
    const result = new Map<
      string,
      Array<{
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
      }>
    >();
    if (!songIds.length) return result;

    const supabase = getSupabaseClient();
    const { data: rows, error: rowsError } = await supabase
      .from('song_featured_artists')
      .select('song_id, featured_user_id')
      .in('song_id', songIds);

    if (rowsError) {
      if (this.isMissingTableError(rowsError, 'song_featured_artists')) {
        return result;
      }
      throw new BadRequestException(
        `Failed to load featured artists: ${rowsError.message}`,
      );
    }

    const pairs = (rows || []) as Array<{
      song_id: string;
      featured_user_id: string;
    }>;
    const userIds = [...new Set(pairs.map((r) => r.featured_user_id))];
    if (!userIds.length) return result;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    if (usersError) {
      throw new BadRequestException(
        `Failed to load featured artist profiles: ${usersError.message}`,
      );
    }

    const userById = new Map(
      (users || []).map((u: any) => [
        u.id as string,
        {
          id: u.id as string,
          displayName: (u.display_name as string | null) ?? null,
          avatarUrl: (u.avatar_url as string | null) ?? null,
        },
      ]),
    );

    for (const pair of pairs) {
      const artist = userById.get(pair.featured_user_id);
      if (!artist) continue;
      const list = result.get(pair.song_id) ?? [];
      list.push(artist);
      result.set(pair.song_id, list);
    }

    return result;
  }

  private async syncFeaturedArtistsForSong(
    songId: string,
    ownerArtistId: string,
    requesterUserId: string,
    featuredArtistIds: string[],
  ): Promise<
    Array<{ id: string; displayName: string | null; avatarUrl: string | null }>
  > {
    const supabase = getSupabaseClient();
    const normalizedIds = [...new Set(featuredArtistIds.map((id) => id.trim()))]
      .filter(Boolean)
      .filter((id) => id !== ownerArtistId);

    const { error: cleanupError } = await supabase
      .from('song_featured_artists')
      .delete()
      .eq('song_id', songId);

    if (
      cleanupError &&
      !this.isMissingTableError(cleanupError, 'song_featured_artists')
    ) {
      throw new BadRequestException(
        `Failed to update featured artists: ${cleanupError.message}`,
      );
    }
    if (
      cleanupError &&
      this.isMissingTableError(cleanupError, 'song_featured_artists')
    ) {
      throw new BadRequestException(
        'Featured artist credits are not available in this environment yet. Please run the latest database migrations.',
      );
    }

    if (!normalizedIds.length) {
      return [];
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, role')
      .in('id', normalizedIds);
    if (usersError) {
      throw new BadRequestException(
        `Failed to validate featured artists: ${usersError.message}`,
      );
    }

    const validUsers = (users || []).filter(
      (u: any) => u.role === 'artist' || u.role === 'admin',
    );
    const validIds = new Set(validUsers.map((u: any) => u.id as string));

    const invalidIds = normalizedIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        'All featured artist tags must be valid artist accounts on this platform.',
      );
    }

    const insertRows = normalizedIds.map((featuredUserId) => ({
      song_id: songId,
      featured_user_id: featuredUserId,
      added_by_user_id: requesterUserId,
    }));
    const { error: upsertError } = await supabase
      .from('song_featured_artists')
      .upsert(insertRows, { onConflict: 'song_id,featured_user_id' });

    if (upsertError) {
      if (this.isMissingTableError(upsertError, 'song_featured_artists')) {
        throw new BadRequestException(
          'Featured artist credits are not available in this environment yet. Please run the latest database migrations.',
        );
      }
      throw new BadRequestException(
        `Failed to save featured artists: ${upsertError.message}`,
      );
    }

    return validUsers.map((u: any) => ({
      id: u.id as string,
      displayName: (u.display_name as string | null) ?? null,
      avatarUrl: (u.avatar_url as string | null) ?? null,
    }));
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 2, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    }),
  )
  async uploadSong(
    @CurrentUser() user: FirebaseUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body()
    body: {
      title: string;
      artistName: string;
      artistOriginCity: string;
      artistOriginState: string;
      stationId: string;
      isExplicit?: boolean;
      lyricsPlainText?: string;
    },
  ) {
    const userData = await this.resolveUploaderUser(user);
    this.assertArtistProfileComplete(userData);

    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Find audio and artwork files by MIME type
    const audioFile = files.find((f) => f.mimetype.startsWith('audio/'));
    const artworkFile = files.find((f) => f.mimetype.startsWith('image/'));

    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    if (!body.stationId || !STATION_IDS.includes(body.stationId as any)) {
      throw new BadRequestException('Valid stationId is required');
    }
    if (!body.artistOriginCity?.trim() || !body.artistOriginState?.trim()) {
      throw new BadRequestException('Artist city and state are required');
    }

    // SECURITY: Extract real duration server-side to prevent spoofing
    // Artists could otherwise claim shorter durations to pay fewer credits
    const durationSeconds = await this.durationService.extractDuration(
      audioFile.buffer,
      audioFile.mimetype,
    );

    const audioUrl = await this.uploadsService.uploadAudioFile(
      audioFile,
      userData.id,
    );
    const artworkUrl = artworkFile
      ? await this.uploadsService.uploadArtworkFile(artworkFile, userData.id)
      : undefined;

    const createSongDto: CreateSongDto = {
      title: body.title,
      artistName: (userData.display_name ?? '').trim(),
      artistOriginCity: body.artistOriginCity.trim(),
      artistOriginState: body.artistOriginState.trim(),
      audioUrl,
      artworkUrl,
      durationSeconds, // Server-validated duration
      stationId: body.stationId,
      // Explicit by default; only clean when the uploader explicitly opts out.
      isExplicit: body.isExplicit !== false,
      lyricsPlainText: body.lyricsPlainText,
    };

    return this.songsService.createSong(userData.id, createSongDto);
  }

  /**
   * Generate a signed upload URL for direct client-to-Supabase uploads.
   * This endpoint allows artists to upload files directly to storage,
   * bypassing the server and reducing bandwidth/memory usage.
   */
  @Post('upload-url')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getUploadUrl(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: GetUploadUrlDto,
  ) {
    const userData = await this.resolveUploaderUser(user);

    return this.uploadsService.getSignedUploadUrl(
      userData.id,
      dto.bucket,
      dto.filename,
      dto.contentType,
    );
  }

  /**
   * Create a song record after files have been uploaded via signed URLs.
   * This endpoint accepts storage paths and converts them to full URLs.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async createSong(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateSongFromPathDto,
  ) {
    const supabase = getSupabaseClient();
    const userData = await this.resolveUploaderUser(user);
    this.assertArtistProfileComplete(userData);

    // Convert storage paths to public URLs
    const { data: audioUrlData } = supabase.storage
      .from('songs')
      .getPublicUrl(dto.audioPath);

    let artworkUrl: string | undefined;
    if (dto.artworkPath) {
      const { data: artworkUrlData } = supabase.storage
        .from('artwork')
        .getPublicUrl(dto.artworkPath);
      artworkUrl = artworkUrlData.publicUrl;
    }

    let discoverClipUrl: string | undefined;
    if (dto.discoverClipPath) {
      const { data: discoverClipUrlData } = supabase.storage
        .from('songs')
        .getPublicUrl(dto.discoverClipPath);
      discoverClipUrl = discoverClipUrlData.publicUrl;
    }

    let discoverBackgroundUrl: string | undefined;
    if (dto.discoverBackgroundPath) {
      const { data: discoverBackgroundUrlData } = supabase.storage
        .from('artwork')
        .getPublicUrl(dto.discoverBackgroundPath);
      discoverBackgroundUrl = discoverBackgroundUrlData.publicUrl;
    }

    // Privacy-policy screening for direct-to-storage image uploads: these
    // bytes never passed through the backend, so scan them by URL now.
    await this.imageModeration.assertImageUrlAllowed(artworkUrl, 'Artwork');
    await this.imageModeration.assertImageUrlAllowed(
      discoverBackgroundUrl,
      'Discover background',
    );

    // SECURITY + DATA QUALITY:
    // For direct-to-storage uploads, compute the real duration server-side from the stored file.
    // This prevents spoofing and avoids the UI/credits falling back to the default 180s.
    let durationSeconds = dto.durationSeconds;
    try {
      const audioUrl = audioUrlData.publicUrl;
      if (audioUrl) {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 15000);
        const res = await fetch(audioUrl, { signal: abortController.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const contentLength = res.headers.get('content-length');
          if (contentLength) {
            const bytes = Number(contentLength);
            // Extra buffer above the 100MB client limit for safety.
            if (Number.isFinite(bytes) && bytes > 105 * 1024 * 1024) {
              this.logger.warn(
                `Skipping duration extraction for large audio (${bytes} bytes) at ${audioUrl}`,
              );
            } else {
              const buf = Buffer.from(await res.arrayBuffer());
              const mimeType = res.headers.get('content-type') ?? undefined;
              durationSeconds = await this.durationService.extractDuration(
                buf,
                mimeType,
              );
            }
          } else {
            const buf = Buffer.from(await res.arrayBuffer());
            const mimeType = res.headers.get('content-type') ?? undefined;
            durationSeconds = await this.durationService.extractDuration(
              buf,
              mimeType,
            );
          }
        } else {
          this.logger.warn(
            `Failed to fetch audio for duration extraction: ${res.status} ${res.statusText}`,
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `Duration extraction failed for direct upload: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    const createSongDto: CreateSongDto = {
      title: dto.title,
      artistName: (userData.display_name ?? '').trim(),
      artistOriginCity: dto.artistOriginCity.trim(),
      artistOriginState: dto.artistOriginState.trim(),
      audioUrl: audioUrlData.publicUrl,
      artworkUrl,
      durationSeconds,
      stationId: dto.stationId,
      discoverClipUrl,
      discoverBackgroundUrl,
      discoverClipStartSeconds: dto.discoverClipStartSeconds,
      discoverClipEndSeconds: dto.discoverClipEndSeconds,
      sampleStartSeconds: dto.sampleStartSeconds,
      sampleEndSeconds: dto.sampleEndSeconds,
      // Explicit by default; only clean when the uploader explicitly opts out.
      isExplicit: dto.isExplicit !== false,
      lyricsPlainText: dto.lyricsPlainText,
    };
    if (
      createSongDto.discoverClipStartSeconds != null &&
      createSongDto.discoverClipEndSeconds != null
    ) {
      const clipDuration =
        createSongDto.discoverClipEndSeconds -
        createSongDto.discoverClipStartSeconds;
      if (clipDuration <= 0 || clipDuration > 15) {
        throw new BadRequestException(
          'Discover clip duration must be greater than 0 and at most 15 seconds',
        );
      }
    }
    if (
      createSongDto.sampleStartSeconds != null &&
      createSongDto.sampleEndSeconds != null
    ) {
      const sampleDuration =
        createSongDto.sampleEndSeconds - createSongDto.sampleStartSeconds;
      if (sampleDuration < 5 || sampleDuration > 30) {
        throw new BadRequestException(
          'Sample clip duration must be between 5 and 30 seconds',
        );
      }
    }

    return this.songsService.createSong(userData.id, createSongDto);
  }

  @Public()
  @Get('station-counts')
  async getStationCounts() {
    const supabase = getSupabaseClient();

    const { data: songs, error: songsErr } = await supabase
      .from('songs')
      .select('station_id, station_ids')
      .eq('status', 'approved');

    if (songsErr) {
      this.logger.warn(`Failed to fetch station counts: ${songsErr.message}`);
      return { counts: {} };
    }

    const counts: Record<string, number> = {};
    const counted = new Map<string, Set<number>>();

    for (let i = 0; i < (songs || []).length; i++) {
      const row = songs[i] as {
        station_id?: string | null;
        station_ids?: string[] | null;
      };

      const stationSet = new Set<string>();
      if (row.station_id) stationSet.add(row.station_id);
      if (Array.isArray(row.station_ids)) {
        for (const sid of row.station_ids) {
          if (typeof sid === 'string' && sid) stationSet.add(sid);
        }
      }

      for (const sid of stationSet) {
        if (!counted.has(sid)) counted.set(sid, new Set());
        if (!counted.get(sid)!.has(i)) {
          counted.get(sid)!.add(i);
          counts[sid] = (counts[sid] || 0) + 1;
        }
      }
    }

    const { data: adminSongs } = await supabase
      .from('admin_fallback_songs')
      .select('radio_id')
      .eq('is_active', true);

    for (const row of adminSongs || []) {
      const rid = (row as { radio_id?: string | null }).radio_id?.trim();
      if (rid) counts[rid] = (counts[rid] || 0) + 1;
    }

    return { counts };
  }

  @Public()
  @Get('public/trending')
  async getPublicTrending(@Query('limit') limitStr?: string) {
    const limit = Math.min(
      Math.max(1, parseInt(limitStr || '12', 10) || 12),
      24,
    );
    return this.songsService.getPublicTrending(limit);
  }

  @Get()
  async getSongs(
    @Query('artistId') artistId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.songsService.getSongs({
      artistId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('discover/feed')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getDiscoverFeed(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('seed') seed?: string,
    @Query('stationId') stationId?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    const limitNum = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 12, 1), 30)
      : 12;
    return this.songsService.getDiscoverFeed(
      userData.id,
      limitNum,
      cursor,
      seed,
      stationId,
    );
  }

  @Post('discover/swipe')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async swipeDiscover(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: {
      songId: string;
      direction: 'left_skip' | 'right_like';
      decisionMs?: number;
      stationId?: string;
    },
  ) {
    if (!body?.songId) throw new BadRequestException('songId is required');
    if (body.direction !== 'left_skip' && body.direction !== 'right_like') {
      throw new BadRequestException(
        'direction must be left_skip or right_like',
      );
    }
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    return this.songsService.swipeDiscoverSong(userData.id, {
      songId: body.songId,
      direction: body.direction,
      decisionMs: body.decisionMs,
      stationId: body.stationId,
    });
  }

  @Get('artists/search')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async searchArtists(@Query('q') q?: string, @Query('limit') limit?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return { items: [] };
    }
    const limitNum = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 15, 1), 30)
      : 15;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, role, email')
      .in('role', ['artist', 'admin'])
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .order('display_name', { ascending: true })
      .limit(limitNum);

    if (error) {
      throw new BadRequestException(
        `Failed to search artists: ${error.message}`,
      );
    }

    return {
      items: (data || []).map((u: any) => ({
        id: u.id as string,
        displayName: (u.display_name as string | null) ?? null,
        avatarUrl: (u.avatar_url as string | null) ?? null,
        role: (u.role as string | null) ?? null,
      })),
    };
  }

  @Get('discover/list')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getDiscoverLikedList(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    const limitNum = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)
      : 50;
    const offsetNum = offset ? Math.max(parseInt(offset, 10) || 0, 0) : 0;
    return this.songsService.getDiscoverLikedList(
      userData.id,
      limitNum,
      offsetNum,
    );
  }

  @Delete('discover/list/:songId')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async removeDiscoverLikedSong(
    @CurrentUser() user: FirebaseUser,
    @Param('songId') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    if (!songId?.trim()) {
      throw new BadRequestException('songId is required');
    }
    await this.songsService.removeDiscoverLike(userData.id, songId.trim());
    return { removed: true };
  }

  @Delete('discover/list')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async clearDiscoverLikedList(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    return this.songsService.clearDiscoverLikedList(userData.id);
  }

  @Delete('discover/swipes/:songId')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async removeDiscoverSwipe(
    @CurrentUser() user: FirebaseUser,
    @Param('songId') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    if (!songId?.trim()) throw new BadRequestException('songId is required');
    await this.songsService.removeDiscoverSwipe(userData.id, songId.trim());
    return { removed: true };
  }

  @Delete('discover/swipes')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async clearDiscoverSwipes(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    return this.songsService.clearDiscoverSwipes(userData.id);
  }

  @Post(':id/discover/publish')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async publishToDiscoverFromLibrary(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body()
    body: {
      clipStartSeconds: number;
      clipEndSeconds: number;
      discoverBackgroundUrl?: string;
    },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');
    if (
      !Number.isFinite(body?.clipStartSeconds) ||
      !Number.isFinite(body?.clipEndSeconds)
    ) {
      throw new BadRequestException(
        'clipStartSeconds and clipEndSeconds are required numbers',
      );
    }
    await this.imageModeration.assertImageUrlAllowed(
      body.discoverBackgroundUrl,
      'Discover background',
    );
    return this.songsService.publishSongToDiscover(
      userData.id,
      userData.role,
      songId,
      {
        clipStartSeconds: body.clipStartSeconds,
        clipEndSeconds: body.clipEndSeconds,
        discoverBackgroundUrl: body.discoverBackgroundUrl,
      },
    );
  }

  /**
   * Get all songs uploaded by the current artist.
   * Includes status, duration, credits allocated, and play count.
   */
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getMySongs(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    let songsQuery = supabase
      .from('songs')
      .select('*')
      .eq('artist_id', userData.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    let { data: songs, error } = await songsQuery;
    if (error && this.isMissingColumnError(error, 'deleted_at')) {
      songsQuery = supabase
        .from('songs')
        .select('*')
        .eq('artist_id', userData.id)
        .order('created_at', { ascending: false });
      const fallback = await songsQuery;
      songs = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw new BadRequestException(`Failed to fetch songs: ${error.message}`);
    }

    const songRows = songs || [];
    const featuredBySongId = await this.getFeaturedArtistsBySongIds(
      songRows.map((song) => song.id as string),
    );
    const songIds = songRows.map((song) => song.id as string);

    // Real per-song stats aggregated from `plays` and `likes` so the numbers
    // reflect actual activity. Uses an RPC to keep aggregation server-side; if
    // the function is missing in older environments we fall back to the cached
    // counters on the songs row.
    const listenCountBySongId = new Map<string, number>();
    const likeCountBySongId = new Map<string, number>();
    const playsCountBySongId = new Map<string, number>();
    if (songIds.length > 0) {
      const { data: statsRows, error: statsError } = await supabase.rpc(
        'get_artist_song_stats',
        // p_since explicitly null = lifetime stats (do not rely on SQL default).
        { p_song_ids: songIds, p_since: null },
      );
      if (statsError) {
        this.logger.warn(
          `get_artist_song_stats RPC unavailable: ${statsError.message}`,
        );
      } else {
        for (const row of (statsRows ?? []) as Array<{
          song_id: string;
          plays_count: number | string | null;
          listener_count_sum: number | string | null;
          like_count: number | string | null;
        }>) {
          if (!row.song_id) continue;
          playsCountBySongId.set(row.song_id, Number(row.plays_count) || 0);
          listenCountBySongId.set(
            row.song_id,
            Number(row.listener_count_sum) || 0,
          );
          likeCountBySongId.set(row.song_id, Number(row.like_count) || 0);
        }
      }
    }

    return Promise.all(
      songRows.map(async (song) => ({
      id: song.id,
      title: song.title,
      artistName: song.artist_name,
      // Artist owns these tracks; sign the full URL from the private bucket so
      // their Studio playback + sample-trim preview keeps working.
      audioUrl: (await signSongAudioUrl(song.audio_url)) ?? song.audio_url,
      sampleUrl: (await signSongAudioUrl(song.sample_url ?? null)) ?? null,
      sampleStartSeconds: song.sample_start_seconds ?? 0,
      sampleEndSeconds: song.sample_end_seconds ?? null,
      priceCents: song.price_cents ?? 99,
      forSale: song.is_for_sale !== false,
      artworkUrl: song.artwork_url,
      durationSeconds: song.duration_seconds,
      creditsRemaining: song.credits_remaining || 0,
      // Prefer the real plays-table count; fall back to the cached counter.
      playCount:
        playsCountBySongId.get(song.id) ?? (song.play_count || 0),
      paidPlayCount: song.paid_play_count || 0,
      freePlayCount: Math.max(
        0,
        (playsCountBySongId.get(song.id) ?? song.play_count ?? 0) -
          (song.paid_play_count || 0),
      ),
      listenCount: listenCountBySongId.get(song.id) ?? 0,
      likeCount: likeCountBySongId.get(song.id) ?? (song.like_count || 0),
      lastPlayedAt: song.last_played_at ?? null,
      trialPlaysUsed: song.trial_plays_used || 0,
      status: song.status,
      stationId: song.station_id || null,
      discoverEnabled: song.discover_enabled || false,
      discoverClipUrl:
        (await signSongAudioUrl(song.discover_clip_url ?? null)) ?? null,
      discoverBackgroundUrl: song.discover_background_url || null,
      discoverClipStartSeconds: song.discover_clip_start_seconds ?? null,
      discoverClipEndSeconds: song.discover_clip_end_seconds ?? null,
      discoverClipDurationSeconds: song.discover_clip_duration_seconds ?? null,
      optInFreePlay: song.opt_in_free_play || false,
      inRefinery: !!(song as { in_refinery?: boolean }).in_refinery,
      isPublic: (song as { is_public?: boolean }).is_public !== false,
      refineryReviewCount:
        (song as { refinery_review_count?: number }).refinery_review_count ?? 0,
      refineryMinReviews:
        (song as { refinery_min_reviews?: number }).refinery_min_reviews ?? 100,
      rejectionReason: song.rejection_reason,
      rejectedAt: song.rejected_at,
      isExplicit: song.is_explicit === true,
      createdAt: song.created_at,
      updatedAt: song.updated_at,
      featuredArtists: featuredBySongId.get(song.id) ?? [],
      })),
    );
  }

  @Get('library')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin', 'dj', 'musician')
  async getLibrarySongs(@CurrentUser() user: FirebaseUser) {
    const { id } = await this.resolveUserIdAndRole(user.uid);
    return this.songsService.getLibrarySongs(id);
  }

  // ─── Song sales: samples, purchases, entitled playback/download ──────

  private async resolveUserIdAndRole(
    firebaseUid: string,
  ): Promise<{ id: string; role: string | null }> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (!data) throw new NotFoundException('User not found');
    return { id: data.id, role: data.role ?? null };
  }

  /**
   * Admin one-time backfill: render the 30s sample for approved songs that
   * don't have one yet. Runs in the background; returns the count queued.
   */
  @Post('admin/backfill-samples')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async backfillSamples(
    @Body() body: { limit?: number; concurrency?: number },
  ) {
    return this.songsService.backfillMissingSamples({
      limit: body?.limit,
      concurrency: body?.concurrency,
    });
  }

  /** "My Music": songs the current user has purchased (full play + download). */
  @Get('purchases')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getPurchasedSongs(@CurrentUser() user: FirebaseUser) {
    const { id } = await this.resolveUserIdAndRole(user.uid);
    return this.songsService.getPurchasedSongs(id);
  }

  /** Whether the current user owns the song + price/sample info for gating UI. */
  @Get(':id/access')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async getSongAccess(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const { id } = await this.resolveUserIdAndRole(user.uid);
    const supabase = getSupabaseClient();
    const { data: song } = await supabase
      .from('songs')
      .select('id, artist_id, price_cents, is_for_sale, sample_url')
      .eq('id', songId)
      .single();
    if (!song) throw new NotFoundException('Song not found');
    const isOwner = song.artist_id === id;
    const owned = await this.songsService.isSongOwnedByUser(id, song);
    return {
      songId: song.id,
      owned,
      isOwner,
      priceCents: song.price_cents ?? 99,
      forSale: song.is_for_sale !== false,
      sampleUrl: (await signSongAudioUrl(song.sample_url ?? null)) ?? null,
    };
  }

  /** Signed full-track URL for streaming (entitled users only). */
  @Get(':id/stream')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async streamFullSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const { id, role } = await this.resolveUserIdAndRole(user.uid);
    return this.songsService.getEntitledFullUrl(id, role, songId);
  }

  /** Signed full-track download URL (entitled users only). */
  @Get(':id/download')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async downloadFullSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const { id, role } = await this.resolveUserIdAndRole(user.uid);
    return this.songsService.getEntitledFullUrl(id, role, songId, {
      download: true,
    });
  }

  /** Set the 30s preview sample start point (owner or admin) and render it. */
  @Post(':id/sample')
  @UseGuards(RolesGuard)
  @Roles('listener', 'artist', 'service_provider', 'admin')
  async setSongSample(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: { startSeconds?: number; endSeconds?: number },
  ) {
    const { id, role } = await this.resolveUserIdAndRole(user.uid);
    return this.songsService.setSongSample(
      id,
      role,
      songId,
      Number(body?.startSeconds ?? 0),
      body?.endSeconds == null ? null : Number(body.endSeconds),
    );
  }

  // ─── Lyrics ──────────────────────────────────────────────────────────

  @Public()
  @Get(':id/lyrics')
  async getLyrics(@Param('id') songId: string) {
    return this.lyricsService.getLyrics(songId);
  }

  @Patch(':id/lyrics')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async upsertLyrics(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body()
    body: {
      plainText?: string;
      timedLines?: Array<{ startMs: number; endMs: number; text: string }>;
    },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) throw new BadRequestException('User not found');

    if (userData.role !== 'admin') {
      const { data: song } = await supabase
        .from('songs')
        .select('artist_id')
        .eq('id', songId)
        .single();
      if (!song) throw new BadRequestException('Song not found');
      if (song.artist_id !== userData.id) {
        throw new ForbiddenException(
          'You can only edit lyrics for your own songs',
        );
      }
    }

    // Explicit timedLines are a manual sync; plain text alone queues
    // automatic caption alignment in the background.
    return this.lyricsService.upsertLyrics(songId, {
      plainText: body.plainText,
      timedLines: body.timedLines,
    });
  }

  // ─── End Lyrics ────────────────────────────────────────────────────

  @Get(':id')
  async getSongById(@Param('id') id: string) {
    return this.songsService.getSongById(id);
  }

  /**
   * Update song settings (opt-in for free play, etc.)
   * Only the song owner or admin can update.
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async updateSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
    @Body() body: UpdateSongDto,
  ) {
    const supabase = getSupabaseClient();

    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    // Verify song ownership (unless admin)
    const { data: song } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', songId)
      .single();

    if (!song) {
      throw new NotFoundException('Song not found');
    }

    if (userData.role !== 'admin' && song.artist_id !== userData.id) {
      throw new ForbiddenException('You can only update your own songs');
    }

    // Build update object
    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) {
      const nextTitle = body.title.trim();
      if (!nextTitle) {
        throw new BadRequestException('Title cannot be empty');
      }
      updateData.title = nextTitle;
    }
    if (body.artworkUrl !== undefined) {
      const nextArtwork = body.artworkUrl.trim();
      if (nextArtwork.length > 0) {
        await this.imageModeration.assertImageUrlAllowed(
          nextArtwork,
          'Artwork',
        );
      }
      updateData.artwork_url = nextArtwork.length > 0 ? nextArtwork : null;
    }
    if (body.stationId !== undefined) {
      updateData.station_id = body.stationId;
    }
    if (body.optInFreePlay !== undefined) {
      updateData.opt_in_free_play = body.optInFreePlay;
    }
    if (body.discoverEnabled !== undefined) {
      updateData.discover_enabled = body.discoverEnabled;
    }
    if (body.discoverClipUrl !== undefined) {
      const nextClip = body.discoverClipUrl.trim();
      updateData.discover_clip_url = nextClip.length > 0 ? nextClip : null;
    }
    if (body.discoverBackgroundUrl !== undefined) {
      const nextBg = body.discoverBackgroundUrl.trim();
      if (nextBg.length > 0) {
        await this.imageModeration.assertImageUrlAllowed(
          nextBg,
          'Discover background',
        );
      }
      updateData.discover_background_url = nextBg.length > 0 ? nextBg : null;
    }
    if (body.discoverClipStartSeconds !== undefined) {
      updateData.discover_clip_start_seconds = body.discoverClipStartSeconds;
    }
    if (body.discoverClipEndSeconds !== undefined) {
      updateData.discover_clip_end_seconds = body.discoverClipEndSeconds;
    }
    if (body.isExplicit !== undefined) {
      updateData.is_explicit = body.isExplicit;
    }
    if (body.isPublic !== undefined) {
      updateData.is_public = body.isPublic;
    }
    if (
      updateData.discover_clip_start_seconds != null &&
      updateData.discover_clip_end_seconds != null
    ) {
      const start = Number(updateData.discover_clip_start_seconds);
      const end = Number(updateData.discover_clip_end_seconds);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new BadRequestException(
          'Discover clip start/end must be valid and end > start',
        );
      }
      const duration = Math.round((end - start) * 100) / 100;
      if (duration > 15) {
        throw new BadRequestException(
          'Discover clip duration must be 15 seconds or less',
        );
      }
      updateData.discover_clip_duration_seconds = duration;
    }
    const featuredArtistIdsProvided = Array.isArray(body.featuredArtistIds);
    if (Object.keys(updateData).length === 1 && !featuredArtistIdsProvided) {
      throw new BadRequestException('No editable fields provided');
    }

    let updateResult = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (
      updateResult.error &&
      this.isMissingColumnError(updateResult.error, 'is_explicit')
    ) {
      const fallbackWithoutExplicit = { ...updateData };
      delete fallbackWithoutExplicit.is_explicit;
      if (Object.keys(fallbackWithoutExplicit).length <= 1) {
        throw new BadRequestException(
          'Explicit content flags are not available in this environment yet. Please run the latest database migrations.',
        );
      }
      updateResult = await supabase
        .from('songs')
        .update(fallbackWithoutExplicit)
        .eq('id', songId)
        .select()
        .single();
    }

    if (
      updateResult.error &&
      this.isMissingAnyDiscoverColumnError(updateResult.error)
    ) {
      const fallbackUpdateData = { ...updateData };
      delete fallbackUpdateData.discover_enabled;
      delete fallbackUpdateData.discover_clip_url;
      delete fallbackUpdateData.discover_background_url;
      delete fallbackUpdateData.discover_clip_start_seconds;
      delete fallbackUpdateData.discover_clip_end_seconds;
      delete fallbackUpdateData.discover_clip_duration_seconds;

      if (Object.keys(fallbackUpdateData).length <= 1) {
        throw new BadRequestException(
          'Discover settings are not available in this environment yet. Please run the latest database migrations.',
        );
      }

      updateResult = await supabase
        .from('songs')
        .update(fallbackUpdateData)
        .eq('id', songId)
        .select()
        .single();
    }

    if (updateResult.error) {
      throw new BadRequestException(`Failed to update song: ${updateResult.error.message}`);
    }
    const updated = updateResult.data;

    let featuredArtists: Array<{
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
    }> = [];
    if (featuredArtistIdsProvided) {
      featuredArtists = await this.syncFeaturedArtistsForSong(
        songId,
        song.artist_id,
        userData.id,
        body.featuredArtistIds || [],
      );
    } else {
      const featuredMap = await this.getFeaturedArtistsBySongIds([songId]);
      featuredArtists = featuredMap.get(songId) ?? [];
    }

    return {
      id: updated.id,
      title: updated.title,
      optInFreePlay: updated.opt_in_free_play,
      artworkUrl: updated.artwork_url,
      stationId: updated.station_id,
      discoverEnabled: updated.discover_enabled,
      discoverClipUrl:
        (await signSongAudioUrl(updated.discover_clip_url ?? null)) ?? null,
      discoverBackgroundUrl: updated.discover_background_url,
      discoverClipStartSeconds: updated.discover_clip_start_seconds,
      discoverClipEndSeconds: updated.discover_clip_end_seconds,
      discoverClipDurationSeconds: updated.discover_clip_duration_seconds,
      isExplicit: updated.is_explicit === true,
      featuredArtists,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async deleteSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const targetSongId = songId.trim();
    if (!targetSongId) {
      throw new BadRequestException('Song id is required');
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const { data: song } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', targetSongId)
      .single();

    if (!song) {
      throw new NotFoundException('Song not found');
    }

    if (userData.role !== 'admin' && song.artist_id !== userData.id) {
      throw new ForbiddenException('You can only delete your own songs');
    }

    await this.adminService.deleteSong(targetSongId);
    return { success: true };
  }

  /**
   * Backfill duration for a song that was uploaded before duration extraction
   * was reliable. Re-extracts the real duration server-side from the stored audio
   * file. Only updates the row when current duration is missing (NULL or 0) so
   * artists cannot retroactively shorten a song to lower credit cost.
   */
  @Post(':id/backfill-duration')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async backfillDuration(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const targetSongId = songId.trim();
    if (!targetSongId) {
      throw new BadRequestException('Song id is required');
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();
    if (!userData) {
      throw new NotFoundException('User not found');
    }

    const { data: song } = await supabase
      .from('songs')
      .select('artist_id, audio_url, duration_seconds')
      .eq('id', targetSongId)
      .single();
    if (!song) {
      throw new NotFoundException('Song not found');
    }
    if (userData.role !== 'admin' && song.artist_id !== userData.id) {
      throw new ForbiddenException('You can only backfill your own songs');
    }
    if (song.duration_seconds && Number(song.duration_seconds) > 0) {
      return {
        durationSeconds: Number(song.duration_seconds),
        backfilled: false,
      };
    }
    if (!song.audio_url) {
      throw new BadRequestException('Song has no audio file to inspect');
    }

    let durationSeconds = 0;
    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 15000);
      const res = await fetch(song.audio_url as string, {
        signal: abortController.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const contentLength = res.headers.get('content-length');
      const bytes = contentLength ? Number(contentLength) : 0;
      if (Number.isFinite(bytes) && bytes > 105 * 1024 * 1024) {
        throw new Error(`Audio too large to inspect (${bytes} bytes)`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get('content-type') ?? undefined;
      durationSeconds = await this.durationService.extractDuration(
        buf,
        mimeType,
      );
    } catch (err) {
      this.logger.warn(
        `Duration backfill failed for song ${targetSongId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadRequestException(
        'Could not extract duration from audio file',
      );
    }

    if (!durationSeconds || durationSeconds <= 0) {
      throw new BadRequestException('Extracted duration was invalid');
    }

    const { error: updateError } = await supabase
      .from('songs')
      .update({ duration_seconds: durationSeconds })
      .eq('id', targetSongId)
      .is('duration_seconds', null);
    if (updateError) {
      this.logger.warn(
        `Failed to persist backfilled duration for ${targetSongId}: ${updateError.message}`,
      );
    }

    return { durationSeconds, backfilled: !updateError };
  }

  @Get(':id/like')
  async getLikeStatus(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.songsService.isLiked(userData.id, songId);
  }

  @Public()
  @Get(':id/likes')
  async getSongLikes(
    @Param('id') songId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.songsService.getSongLikes(songId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/like')
  async toggleLike(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.songsService.likeSong(userData.id, songId);
  }

  @Delete(':id/like')
  async unlikeSong(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new NotFoundException('User not found');
    }

    return this.songsService.unlikeSong(userData.id, songId);
  }

  /**
   * Public endpoint to record a discography/profile listen.
   * Auth is optional: if an Authorization header is present, we verify it and attach user_id.
   */
  @Public()
  @Post(':id/profile-listen')
  async recordProfileListen(
    @Param('id') songId: string,
    @Headers('authorization') authorization?: string,
    @Body() _body?: { startedAt?: string; secondsListened?: number },
  ) {
    let userId: string | null = null;

    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);
      try {
        const decoded = await getFirebaseAuth().verifyIdToken(token);
        const supabase = getSupabaseClient();
        const { data: userData } = await supabase
          .from('users')
          .select('id, is_banned, ban_reason')
          .eq('firebase_uid', decoded.uid)
          .single();
        if (userData?.is_banned) {
          throw new ForbiddenException(
            userData.ban_reason
              ? `Account suspended: ${userData.ban_reason}`
              : 'Your account has been suspended',
          );
        }
        userId = userData?.id ?? null;
      } catch (e) {
        // If the client sends an auth header, it must be valid.
        throw new UnauthorizedException('Invalid token');
      }
    }

    return this.songsService.recordProfileListen(songId, userId);
  }
}
