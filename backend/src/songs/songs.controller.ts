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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SongsService } from './songs.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateSongDto } from './dto/create-song.dto';
import { CreateSongFromPathDto } from './dto/create-song-from-path.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

interface UserIdRow {
  id: string;
}

interface UserIdRoleRow extends UserIdRow {
  role?: string;
}

interface SongRow {
  id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  audio_url: string;
  artwork_url?: string | null;
  duration_seconds?: number | null;
  credits_remaining?: number | null;
  play_count?: number | null;
  like_count?: number | null;
  status: string;
  opt_in_free_play?: boolean | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Controller('songs')
export class SongsController {
  constructor(
    private readonly songsService: SongsService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 2, {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadSong(
    @CurrentUser() user: FirebaseUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { title: string; artistName: string },
  ) {
    const supabase = getSupabaseClient();
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
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
      audioUrl,
      artworkUrl,
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
  @Roles('artist', 'admin')
  async getUploadUrl(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: GetUploadUrlDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
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
  @Roles('artist', 'admin')
  async createSong(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: CreateSongFromPathDto,
  ) {
    const supabase = getSupabaseClient();
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
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

    const createSongDto: CreateSongDto = {
      title: dto.title,
      artistName: dto.artistName,
      audioUrl: audioUrlData.publicUrl,
      artworkUrl,
    };

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

  /**
   * Get all songs uploaded by the current artist.
   * Includes status, duration, credits allocated, and play count.
   */
  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async getMySongs(@CurrentUser() user: FirebaseUser) {
    const supabase = getSupabaseClient();
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
    if (!userData) {
      throw new Error('User not found');
    }

    const { data: songsData, error } = await supabase
      .from('songs')
      .select('*')
      .eq('artist_id', userData.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }

    const songs = (songsData ?? []) as SongRow[];
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
      optInFreePlay: song.opt_in_free_play || false,
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
    @Body() body: { optInFreePlay?: boolean },
  ) {
    const supabase = getSupabaseClient();

    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id, role')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRoleRow | null;
    if (!userData) {
      throw new Error('User not found');
    }

    // Verify song ownership (unless admin)
    const { data: songData } = await supabase
      .from('songs')
      .select('artist_id')
      .eq('id', songId)
      .single();

    const song = songData as { artist_id: string } | null;
    if (!song) {
      throw new Error('Song not found');
    }

    if (userData.role !== 'admin' && song.artist_id !== userData.id) {
      throw new ForbiddenException('You can only update your own songs');
    }

    // Build update object
    const updateData: {
      updated_at: string;
      opt_in_free_play?: boolean;
    } = { updated_at: new Date().toISOString() };
    if (body.optInFreePlay !== undefined) {
      updateData.opt_in_free_play = body.optInFreePlay;
    }

    const { data: updatedRaw, error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update song: ${error.message}`);
    }

    const updated = updatedRaw as SongRow;
    return {
      id: updated.id,
      title: updated.title,
      optInFreePlay: updated.opt_in_free_play ?? false,
    };
  }

  @Get(':id/like')
  async getLikeStatus(
    @CurrentUser() user: FirebaseUser,
    @Param('id') songId: string,
  ) {
    const supabase = getSupabaseClient();
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
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
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
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
    const { data: userDataRaw } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', user.uid)
      .single();

    const userData = userDataRaw as UserIdRow | null;
    if (!userData) {
      throw new Error('User not found');
    }

    return this.songsService.unlikeSong(userData.id, songId);
  }
}
