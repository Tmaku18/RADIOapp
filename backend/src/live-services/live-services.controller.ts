import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LiveServicesService } from './live-services.service';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { SubmitLiveSupportDto } from './dto/submit-live-support.dto';

@Controller('live-services')
export class LiveServicesController {
  constructor(private readonly liveServices: LiveServicesService) {}

  private async getUserId(uid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();
    if (!data) throw new Error('User not found');
    return data.id;
  }

  private async getUserProfile(uid: string): Promise<{
    id: string;
    email: string | null;
    displayName: string | null;
    role: string | null;
  }> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id, email, display_name, role')
      .eq('firebase_uid', uid)
      .single();
    if (!data) throw new Error('User not found');
    return {
      id: data.id,
      email: (data.email ?? null) as string | null,
      displayName: (data.display_name ?? null) as string | null,
      role: (data.role ?? null) as string | null,
    };
  }

  @Get('artist/:artistId')
  async listByArtist(@Param('artistId') artistId: string) {
    return this.liveServices.listByArtist(artistId);
  }

  @Get('upcoming')
  async upcomingFromFollowed(
    @CurrentUser() user: FirebaseUser,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.liveServices.upcomingFromFollowed(userId, limitNum);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async listMine(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.liveServices.listMine(userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async create(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: {
      title: string;
      description?: string;
      type?: string;
      scheduledAt?: string;
      linkOrPlace?: string;
    },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.liveServices.create(userId, {
      title: body.title,
      description: body.description,
      type: body.type as any,
      scheduledAt: body.scheduledAt,
      linkOrPlace: body.linkOrPlace,
    });
  }

  @Post('support')
  @UseGuards(RolesGuard)
  @Roles('artist', 'service_provider', 'admin')
  async submitSupport(
    @CurrentUser() user: FirebaseUser,
    @Body() body: SubmitLiveSupportDto,
  ) {
    const profile = await this.getUserProfile(user.uid);
    return this.liveServices.submitSupportRequest({
      userId: profile.id,
      userEmail: profile.email,
      userDisplayName: profile.displayName,
      userRole: profile.role,
      message: body.message,
      discordLink: body.discordLink,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.liveServices.getById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async update(
    @CurrentUser() user: FirebaseUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      type?: string;
      scheduledAt?: string;
      linkOrPlace?: string;
    },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.liveServices.update(id, userId, {
      title: body.title,
      description: body.description,
      type: body.type as any,
      scheduledAt: body.scheduledAt,
      linkOrPlace: body.linkOrPlace,
    });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('artist', 'admin')
  async delete(@CurrentUser() user: FirebaseUser, @Param('id') id: string) {
    const userId = await this.getUserId(user.uid);
    await this.liveServices.delete(id, userId);
    return { deleted: true };
  }
}

@Controller('artists')
export class ArtistFollowsController {
  constructor(private readonly liveServices: LiveServicesService) {}

  private async getUserId(uid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', uid)
      .single();
    if (!data) throw new Error('User not found');
    return data.id;
  }

  @Post(':artistId/follow')
  async follow(
    @CurrentUser() user: FirebaseUser,
    @Param('artistId') artistId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.liveServices.followArtist(userId, artistId);
    return { followed: true };
  }

  @Delete(':artistId/follow')
  async unfollow(
    @CurrentUser() user: FirebaseUser,
    @Param('artistId') artistId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    await this.liveServices.unfollowArtist(userId, artistId);
    return { unfollowed: true };
  }

  @Get(':artistId/follow')
  async isFollowing(
    @CurrentUser() user: FirebaseUser,
    @Param('artistId') artistId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    const following = await this.liveServices.isFollowing(userId, artistId);
    return { following };
  }
}
