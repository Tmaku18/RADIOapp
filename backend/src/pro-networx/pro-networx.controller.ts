import {
  Controller,
  Get,
  Put,
  Query,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ProNetworxService } from './pro-networx.service';
import { UpdateProProfileDto } from './dto/update-pro-profile.dto';
import { ListProDirectoryDto } from './dto/list-pro-directory.dto';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('pro-networx')
@UseGuards(FirebaseAuthGuard)
export class ProNetworxController {
  constructor(private readonly pro: ProNetworxService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data?.id) {
      throw new Error('User not found');
    }
    return data.id;
  }

  @Get('me/profile')
  async getMe(@CurrentUser() user: FirebaseUser) {
    return this.pro.getMyProfile(user.uid);
  }

  @Put('me/profile')
  async upsertMe(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: UpdateProProfileDto,
  ) {
    return this.pro.upsertMyProfile(user.uid, dto);
  }

  @Get('directory')
  async list(
    @CurrentUser() user: FirebaseUser,
    @Query() q: ListProDirectoryDto,
  ) {
    const viewerUserId = await this.getUserId(user.uid);
    return this.pro.listDirectory({
      viewerUserId,
      skill: q.skill,
      availableForWork:
        q.availableForWork != null ? q.availableForWork === 'true' : undefined,
      search: q.search,
      location: q.location,
      sort: q.sort,
      mode: q.mode,
      seed: q.seed,
    });
  }

  @Get('profiles/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.pro.getProfileByUserId(userId);
  }

  @Public()
  @Get('public/directory')
  async listPublic(@Query() q: ListProDirectoryDto) {
    return this.pro.listDirectory({
      skill: q.skill,
      availableForWork:
        q.availableForWork != null ? q.availableForWork === 'true' : undefined,
      search: q.search,
      location: q.location,
      sort: q.sort,
      mode: q.mode,
      seed: q.seed,
    });
  }

  @Public()
  @Get('public/profiles/:userId')
  async getPublicProfile(@Param('userId') userId: string) {
    return this.pro.getProfileByUserId(userId);
  }
}
