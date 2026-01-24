import {
  Controller,
  Get,
  Patch,
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
    const song = await this.adminService.updateSongStatus(songId, dto.status);
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
}
