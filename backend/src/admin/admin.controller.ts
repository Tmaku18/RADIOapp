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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateSongStatusDto } from './dto/update-song-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Helper to get admin's database user ID from Firebase UID.
   */
  private async getAdminDbId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    return data?.id;
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
    const adminId = await this.getAdminDbId(admin.uid);
    const song = await this.adminService.updateSongStatus(songId, dto.status, dto.reason, adminId);
    return { song };
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

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: 'listener' | 'artist' | 'admin',
  ) {
    const user = await this.adminService.updateUserRole(userId, role);
    return { user };
  }

  // ========== Fallback Playlist Endpoints ==========

  @Get('fallback-songs')
  async getFallbackSongs() {
    const songs = await this.adminService.getFallbackSongs();
    return { songs };
  }

  @Post('fallback-songs')
  async addFallbackSong(
    @Body() dto: {
      title: string;
      artistName: string;
      audioUrl: string;
      artworkUrl?: string;
      durationSeconds?: number;
    },
  ) {
    const song = await this.adminService.addFallbackSong(dto);
    return { song };
  }

  @Patch('fallback-songs/:id')
  async updateFallbackSong(
    @Param('id') songId: string,
    @Body() dto: { isActive?: boolean },
  ) {
    const song = await this.adminService.updateFallbackSong(songId, dto);
    return { song };
  }

  @Delete('fallback-songs/:id')
  async deleteFallbackSong(@Param('id') songId: string) {
    return this.adminService.deleteFallbackSong(songId);
  }

  // ========== User Ban Management Endpoints ==========

  /**
   * Get all banned users (hard and shadow banned).
   */
  @Get('users/banned')
  async getBannedUsers() {
    const users = await this.adminService.getBannedUsers();
    return { users };
  }

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
    const adminId = await this.getAdminDbId(admin.uid);
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
    const adminId = await this.getAdminDbId(admin.uid);
    const result = await this.adminService.shadowBanUser(userId, adminId, dto.reason);
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
    const song = await this.adminService.toggleFreeRotation(songId, body.enabled);
    return { song };
  }

  /**
   * Get all songs currently in free rotation.
   */
  @Get('free-rotation/songs')
  async getSongsInFreeRotation() {
    const songs = await this.adminService.getSongsInFreeRotation();
    return { songs, total: songs.length };
  }
}
