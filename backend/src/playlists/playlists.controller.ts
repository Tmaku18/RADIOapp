import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { PlaylistsService } from './playlists.service';

@Controller('playlists')
@UseGuards(FirebaseAuthGuard)
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('mine')
  async listMine(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.listMine(userId);
  }

  @Post()
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { title: string; description?: string },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.create(userId, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.update(userId, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.remove(userId, id);
  }

  @Get(':id/tracks')
  async tracks(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.getTracks(userId, id);
  }

  @Post(':id/tracks')
  async addTrack(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { songId: string },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.addTrack(userId, id, body.songId);
  }

  @Delete(':id/tracks/:songId')
  async removeTrack(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Param('songId') songId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.removeTrack(userId, id, songId);
  }

  @Post(':id/reorder')
  async reorder(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { songIds: string[] },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.playlists.reorder(userId, id, body.songIds ?? []);
  }
}
