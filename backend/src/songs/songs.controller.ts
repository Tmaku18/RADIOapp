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
import { getFirebaseAuth } from '../config/firebase.config';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { STATION_IDS } from '../radio/station.constants';

@Controller('songs')
export class SongsController {
  private readonly logger = new Logger(SongsController.name);

  constructor(
    private readonly songsService: SongsService,
    private readonly uploadsService: UploadsService,
    private readonly durationService: DurationService,
  ) {}

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
    },
  ) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    if (!files || files.length === 0) {
      throw new Error('No files uploaded');
    }

    // Find audio and artwork files by MIME type
    const audioFile = files.find((f) => f.mimetype.startsWith('audio/'));
    const artworkFile = files.find((f) => f.mimetype.startsWith('image/'));

    if (!audioFile) {
      throw new Error('Audio file is required');
    }

    if (!body.stationId || !STATION_IDS.includes(body.stationId as any)) {
      throw new Error('Valid stationId is required');
    }
    if (!body.artistOriginCity?.trim() || !body.artistOriginState?.trim()) {
      throw new Error('Artist city and state are required');
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
      artistName: body.artistName,
      artistOriginCity: body.artistOriginCity.trim(),
      artistOriginState: body.artistOriginState.trim(),
      audioUrl,
      artworkUrl,
      durationSeconds, // Server-validated duration
      stationId: body.stationId,
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
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

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
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

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
      artistName: dto.artistName,
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

    return this.songsService.createSong(userData.id, createSongDto);
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
    return this.songsService.getDiscoverFeed(userData.id, limitNum, cursor);
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
    });
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

  /**
   * Get all songs uploaded by the current artist.
   * Includes status, duration, credits allocated, and play count.
   */
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getMySongs(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    if (!userData) {
      throw new Error('User not found');
    }

    const { data: songs, error } = await supabase
      .from('songs')
      .select('*')
      .eq('artist_id', userData.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }

    return songs.map((song) => ({
      id: song.id,
      title: song.title,
      artistName: song.artist_name,
      audioUrl: song.audio_url,
      artworkUrl: song.artwork_url,
      durationSeconds: song.duration_seconds,
      creditsRemaining: song.credits_remaining || 0,
      playCount: song.play_count || 0,
      likeCount: song.like_count || 0,
      status: song.status,
      stationId: song.station_id || null,
      discoverEnabled: song.discover_enabled || false,
      discoverClipUrl: song.discover_clip_url || null,
      discoverBackgroundUrl: song.discover_background_url || null,
      discoverClipStartSeconds: song.discover_clip_start_seconds ?? null,
      discoverClipEndSeconds: song.discover_clip_end_seconds ?? null,
      discoverClipDurationSeconds: song.discover_clip_duration_seconds ?? null,
      optInFreePlay: song.opt_in_free_play || false,
      inRefinery: !!(song as { in_refinery?: boolean }).in_refinery,
      rejectionReason: song.rejection_reason,
      rejectedAt: song.rejected_at,
      createdAt: song.created_at,
      updatedAt: song.updated_at,
    }));
  }

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
      throw new Error('User not found');
    }

    // Verify song ownership (unless admin)
    const { data: song } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', songId)
      .single();

    if (!song) {
      throw new Error('Song not found');
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
      updateData.discover_background_url = nextBg.length > 0 ? nextBg : null;
    }
    if (body.discoverClipStartSeconds !== undefined) {
      updateData.discover_clip_start_seconds = body.discoverClipStartSeconds;
    }
    if (body.discoverClipEndSeconds !== undefined) {
      updateData.discover_clip_end_seconds = body.discoverClipEndSeconds;
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
    if (Object.keys(updateData).length === 1) {
      throw new BadRequestException('No editable fields provided');
    }

    const { data: updated, error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update song: ${error.message}`);
    }

    return {
      id: updated.id,
      title: updated.title,
      optInFreePlay: updated.opt_in_free_play,
      artworkUrl: updated.artwork_url,
      stationId: updated.station_id,
      discoverEnabled: updated.discover_enabled,
      discoverClipUrl: updated.discover_clip_url,
      discoverBackgroundUrl: updated.discover_background_url,
      discoverClipStartSeconds: updated.discover_clip_start_seconds,
      discoverClipEndSeconds: updated.discover_clip_end_seconds,
      discoverClipDurationSeconds: updated.discover_clip_duration_seconds,
    };
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
      throw new Error('User not found');
    }

    return this.songsService.isLiked(userData.id, songId);
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
      throw new Error('User not found');
    }

    return this.songsService.toggleLike(userData.id, songId);
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
      throw new Error('User not found');
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
