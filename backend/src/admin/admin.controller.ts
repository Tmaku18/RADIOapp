import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateSongStatusDto } from './dto/update-song-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { DEFAULT_RADIO_ID } from '../radio/radio-state.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Helper to get admin's database user ID from Firebase UID.
   * Falls back to email and backfills firebase_uid when needed.
   */
  private async getAdminDbId(
    firebaseUid: string,
    email?: string | null,
  ): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (data?.id) return data.id;

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;

    const { data: byEmail } = await supabase
      .from('users')
      .select('id, role, firebase_uid')
      .eq('email', normalizedEmail)
      .single();
    if (!byEmail?.id || byEmail.role !== 'admin') return null;

    if (byEmail.firebase_uid !== firebaseUid) {
      await supabase
        .from('users')
        .update({ firebase_uid: firebaseUid })
        .eq('id', byEmail.id);
    }
    return byEmail.id;
  }

  @Get('songs')
  async getSongs(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const songs = await this.adminService.getSongsPendingApproval({
      status,
      search,
      sortBy,
      sortOrder,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { songs, total: songs.length };
  }

  @Patch('songs/:id')
  async updateSongStatus(
    @CurrentUser() admin: FirebaseUser,
    @Param('id') songId: string,
    @Body() dto: UpdateSongStatusDto,
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) {
      throw new BadRequestException('Admin user not found');
    }
    const song = await this.adminService.updateSongStatus(
      songId,
      dto.status,
      dto.reason,
      adminId,
    );
    return { song };
  }

  @Patch('songs/:id/metadata')
  async updateSongMetadata(
    @Param('id') songId: string,
    @Body()
    body: {
      title?: string;
      stationId?: string;
      stationIds?: string[];
      artworkUrl?: string | null;
      isExplicit?: boolean;
    },
  ) {
    const song = await this.adminService.updateSongMetadata(songId, body);
    return { song };
  }

  @Post('songs/:id/trim')
  async trimSong(
    @Param('id') songId: string,
    @Body() dto: { startSeconds: number; endSeconds: number },
  ) {
    return this.adminService.trimSongAudio(
      songId,
      Number(dto.startSeconds),
      Number(dto.endSeconds),
    );
  }

  @Delete('songs/:id')
  async deleteSong(@Param('id') songId: string) {
    await this.adminService.deleteSong(songId);
    return { deleted: true };
  }

  @Get('swipe')
  async getSwipeCards(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getSwipeCards({
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Delete('swipe/:songId/clip')
  async deleteSwipeClip(@Param('songId') songId: string) {
    if (!songId?.trim()) {
      throw new BadRequestException('songId is required');
    }
    return this.adminService.deleteSwipeClip(songId.trim());
  }

  @Get('analytics')
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users')
  async getUsers(
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const users = await this.adminService.getAllUsers({
      role,
      search,
      sortBy,
      sortOrder,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { users, total: users.length };
  }

  @Get('users/:id')
  async getUserProfile(@Param('id') userId: string) {
    return this.adminService.getUserProfile(userId);
  }

  @Get('streamer-applications')
  async getStreamerApplications() {
    const applications = await this.adminService.listStreamerApplications();
    return { applications };
  }

  @Patch('streamer-applications/:userId')
  async setStreamerApproval(
    @Param('userId') userId: string,
    @Body() body: { action: 'approve' | 'reject' },
  ) {
    const action = body?.action === 'reject' ? 'reject' : 'approve';
    return this.adminService.setStreamerApproval(userId, action);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: 'listener' | 'artist' | 'admin',
  ) {
    const user = await this.adminService.updateUserRole(userId, role);
    return { user };
  }

  // ========== Radios (stations) – for fallback multi-select, state-scoped ==========

  @Get('radios')
  getRadios(@Query('state') stateCode?: string) {
    return { radios: this.adminService.getRadios(stateCode) };
  }

  @Get('radios/:id/queue-debug')
  async getRadioQueueDebug(
    @Param('id') radioId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.adminService.getRadioQueueDebug(id, safeLimit);
  }

  @Get('radios/:id/queue')
  async getRadioQueue(
    @Param('id') radioId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.adminService.getRadioQueue(id, safeLimit);
  }

  @Post('radios/:id/queue')
  async addRadioQueueEntry(
    @Param('id') radioId: string,
    @Body()
    body: {
      items?: Array<{
        stackId?: string;
        songId?: string;
        source?: 'songs';
      }>;
      stackId?: string;
      songId?: string;
      source?: 'songs';
      position?: number;
      allowDuplicates?: boolean;
    },
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const items = Array.isArray(body?.items)
      ? body.items
      : [
          {
            stackId: body?.stackId,
            songId: body?.songId,
            source: body?.source,
          },
        ];
    if (!items.length) {
      throw new BadRequestException('At least one queue item is required');
    }
    if (items.length > 100) {
      throw new BadRequestException('Cannot add more than 100 items at once');
    }
    return this.adminService.addRadioQueueEntries(id, {
      items,
      position: body?.position,
      allowDuplicates: body?.allowDuplicates === true,
    });
  }

  @Patch('radios/:id/queue')
  async replaceRadioQueue(
    @Param('id') radioId: string,
    @Body()
    body: {
      stackIds?: string[];
    },
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const stackIds = Array.isArray(body?.stackIds) ? body.stackIds : [];
    if (stackIds.length > 1000) {
      throw new BadRequestException('Queue cannot exceed 1000 entries');
    }
    return this.adminService.replaceRadioQueue(id, stackIds);
  }

  @Post('radios/:id/queue/skip')
  async skipRadioQueueTrack(@Param('id') radioId: string) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.adminService.skipRadioQueueTrack(id);
  }

  @Delete('radios/:id/queue')
  async removeRadioQueueEntry(
    @Param('id') radioId: string,
    @Query('position') position?: string,
    @Query('stackId') stackId?: string,
    @Query('songId') songId?: string,
    @Query('source') source?: 'songs',
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const parsedPosition =
      typeof position === 'string' && position.length > 0
        ? parseInt(position, 10)
        : undefined;
    const hasByPosition =
      typeof parsedPosition === 'number' && Number.isFinite(parsedPosition);
    if (!hasByPosition && !stackId && !songId) {
      throw new BadRequestException(
        'Provide position, stackId, or songId to remove an entry',
      );
    }
    return this.adminService.removeRadioQueueEntry(id, {
      position: hasByPosition ? parsedPosition : undefined,
      stackId,
      songId,
      source,
    });
  }

  // ========== Fallback Playlist Endpoints ==========

  @Get('fallback-songs/grouped')
  async getFallbackSongsGrouped() {
    const songs = await this.adminService.getFallbackSongsGrouped();
    return { songs };
  }

  @Patch('fallback-songs/:id/radios')
  async setFallbackSongRadios(
    @Param('id') representativeRowId: string,
    @Body() body: { radioIds: string[] },
  ) {
    return this.adminService.setFallbackSongRadios(
      representativeRowId,
      Array.isArray(body.radioIds) ? body.radioIds : [],
    );
  }

  @Patch('fallback-songs/:id/group')
  async updateFallbackSongGroup(
    @Param('id') representativeRowId: string,
    @Body() dto: { isActive?: boolean },
  ) {
    return this.adminService.updateFallbackSongGroup(representativeRowId, dto);
  }

  @Delete('fallback-songs/:id/group')
  async deleteFallbackSongGroup(@Param('id') representativeRowId: string) {
    return this.adminService.deleteFallbackSongGroup(representativeRowId);
  }

  @Get('fallback-songs')
  async getFallbackSongs(@Query('radio') radioId?: string) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const songs = await this.adminService.getFallbackSongs(id);
    return { songs };
  }

  @Post('fallback-songs')
  async addFallbackSong(
    @Body()
    dto: {
      title: string;
      artistName: string;
      audioUrl: string;
      artworkUrl?: string;
      durationSeconds?: number;
    },
    @Query('radio') radioId?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const song = await this.adminService.addFallbackSong(dto, id);
    return { song };
  }

  @Post('fallback-songs/from-upload')
  async addFallbackSongFromUpload(
    @CurrentUser() user: FirebaseUser,
    @Body()
    dto: {
      title: string;
      artistName: string;
      audioPath: string;
      artworkPath?: string;
      durationSeconds?: number;
    },
    @Query('radio') radioId?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const adminId = await this.getAdminDbId(user.uid, user.email);
    if (!adminId) {
      throw new BadRequestException('Admin user not found');
    }
    const song = await this.adminService.addFallbackSongFromUpload(
      adminId,
      dto,
      id,
    );
    return { song };
  }

  @Post('fallback-songs/from-song/:songId')
  async addFallbackSongFromSong(
    @Param('songId') songId: string,
    @Query('radio') radioId?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const song = await this.adminService.addFallbackSongFromSong(songId, id);
    return { song };
  }

  @Patch('fallback-songs/:id')
  async updateFallbackSong(
    @Param('id') songId: string,
    @Body() dto: { isActive?: boolean },
    @Query('radio') radioId?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    const song = await this.adminService.updateFallbackSong(songId, dto, id);
    return { song };
  }

  @Delete('fallback-songs/:id')
  async deleteFallbackSong(
    @Param('id') songId: string,
    @Query('radio') radioId?: string,
  ) {
    const id = radioId?.trim() || DEFAULT_RADIO_ID;
    return this.adminService.deleteFallbackSong(songId, id);
  }

  // ========== User Ban Management Endpoints ==========

  /**
   * Hard ban a user - full lockout with token revocation.
   * Use for ToS violators.
   */
  @Post('users/:id/hard-ban')
  async hardBanUser(
    @CurrentUser() admin: FirebaseUser,
    @Param('id') userId: string,
    @Body() dto: { reason: string; deleteData?: boolean },
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    const result = await this.adminService.hardBanUser(
      userId,
      adminId,
      dto.reason,
      dto.deleteData ?? false,
    );
    return result;
  }

  /**
   * Shadow ban a user - user thinks they're active but invisible.
   * Use for chat trolls.
   */
  @Post('users/:id/shadow-ban')
  async shadowBanUser(
    @CurrentUser() admin: FirebaseUser,
    @Param('id') userId: string,
    @Body() dto: { reason: string },
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    const result = await this.adminService.shadowBanUser(
      userId,
      adminId,
      dto.reason,
    );
    return result;
  }

  /**
   * Restore a banned user's access (undo hard or shadow ban).
   */
  @Post('users/:id/restore')
  async restoreUser(@Param('id') userId: string) {
    const result = await this.adminService.restoreUser(userId);
    return result;
  }

  /**
   * Delete account: remove all user data and Firebase credentials.
   * User can sign up again after deletion.
   */
  @Delete('users/:id')
  async deleteUserAccount(
    @CurrentUser() admin: FirebaseUser,
    @Param('id') userId: string,
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    if (adminId === userId) {
      throw new BadRequestException('Cannot delete your own account');
    }
    await this.adminService.deleteUserAccount(userId);
    return { deleted: true };
  }

  /**
   * Lifetime ban / deactivate account: delete all artist songs, clean storage,
   * disable Firebase user. Keeps user record so they cannot create a new account.
   */
  @Post('users/:id/lifetime-ban')
  async lifetimeBanUser(
    @CurrentUser() admin: FirebaseUser,
    @Param('id') userId: string,
    @Body() dto: { reason?: string },
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    const result = await this.adminService.lifetimeBanUser(
      userId,
      adminId,
      dto.reason || 'Lifetime ban by admin',
    );
    return result;
  }

  // =============================================
  // FREE ROTATION SEARCH ENDPOINTS (Item 5)
  // =============================================

  /**
   * Search songs by title for free rotation management.
   */
  @Get('free-rotation/search/songs')
  async searchSongsForFreeRotation(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return { songs: [] };
    }
    const songs = await this.adminService.searchSongsForFreeRotation(query);
    return { songs };
  }

  /**
   * Search users by name or email.
   */
  @Get('free-rotation/search/users')
  async searchUsersForFreeRotation(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return { users: [] };
    }
    const users = await this.adminService.searchUsersForFreeRotation(query);
    return { users };
  }

  /**
   * Get songs by a specific user for free rotation management.
   */
  @Get('free-rotation/users/:id/songs')
  async getUserSongsForFreeRotation(@Param('id') userId: string) {
    const songs = await this.adminService.getUserSongsForFreeRotation(userId);
    return { songs };
  }

  /**
   * Toggle free rotation for a song.
   */
  @Patch('free-rotation/songs/:id')
  async toggleFreeRotation(
    @Param('id') songId: string,
    @Body() body: { enabled: boolean },
  ) {
    const song = await this.adminService.toggleFreeRotation(
      songId,
      body.enabled,
    );
    return { song };
  }

  /**
   * Get all songs currently in free rotation.
   */
  @Get('free-rotation/songs')
  async getSongsInFreeRotation(@Query('radio') radioId?: string) {
    const songs = await this.adminService.getSongsInFreeRotation(radioId);
    return { songs, total: songs.length };
  }

  // ========== Live Broadcast ==========

  @Post('live/start')
  async startLive(@CurrentUser() admin: FirebaseUser) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    return this.adminService.startLiveBroadcast(adminId);
  }

  @Post('live/stop')
  async stopLive() {
    return this.adminService.stopLiveBroadcast();
  }

  @Get('live/status')
  async getLiveStatus() {
    return this.adminService.getLiveBroadcastStatus();
  }

  // ========== Browse Feed Management ==========

  @Get('feed-media')
  async getFeedMedia(@Query('reportedOnly') reportedOnly?: string) {
    return this.adminService.getFeedMedia(reportedOnly === 'true');
  }

  @Patch('feed-media/:contentId/remove')
  async removeFromFeed(
    @CurrentUser() admin: FirebaseUser,
    @Param('contentId') contentId: string,
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    await this.adminService.removeFromFeed(contentId, adminId);
    return { removed: true };
  }

  @Delete('feed-media/:contentId')
  async deleteFeedMedia(
    @CurrentUser() admin: FirebaseUser,
    @Param('contentId') contentId: string,
  ) {
    const adminId = await this.getAdminDbId(admin.uid, admin.email);
    if (!adminId) throw new BadRequestException('Admin user not found');
    await this.adminService.deleteFeedMedia(contentId, adminId);
    return { deleted: true };
  }
}
