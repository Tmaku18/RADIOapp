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

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('songs')
  async getSongs(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const songs = await this.adminService.getSongsPendingApproval({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { songs, total: songs.length };
  }

  @Patch('songs/:id')
  async updateSongStatus(
    @Param('id') songId: string,
    @Body() dto: UpdateSongStatusDto,
  ) {
    const song = await this.adminService.updateSongStatus(songId, dto.status, dto.reason);
    return { song };
  }

  @Get('analytics')
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users')
  async getUsers(
    @Query('role') role?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const users = await this.adminService.getAllUsers({
      role,
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
}
