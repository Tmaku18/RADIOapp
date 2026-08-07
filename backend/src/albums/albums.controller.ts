import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { AlbumsService } from './albums.service';

@Controller('albums')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('artist', 'admin')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  private async getArtistId(firebaseUid: string): Promise<string> {
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
    const artistId = await this.getArtistId(user.uid);
    return this.albums.listMine(artistId);
  }

  @Post()
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: {
      title: string;
      releaseType?: string;
      artworkUrl?: string | null;
      releaseDate?: string | null;
    },
  ) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.create(artistId, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      releaseType?: string;
      artworkUrl?: string | null;
      releaseDate?: string | null;
    },
  ) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.update(artistId, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.remove(artistId, id);
  }

  @Put(':id/tracks')
  async setTracks(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { songIds: string[] },
  ) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.setTracks(artistId, id, body.songIds ?? []);
  }

  @Post(':id/tracks')
  async addTrack(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body() body: { songId: string },
  ) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.addTrack(artistId, id, body.songId);
  }

  @Delete(':id/tracks/:songId')
  async removeTrack(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Param('songId') songId: string,
  ) {
    const artistId = await this.getArtistId(user.uid);
    return this.albums.removeTrack(artistId, id, songId);
  }
}
