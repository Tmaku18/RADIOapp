import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { GrowthService } from './growth.service';

@Controller('growth')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  private async userId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();
    if (!data?.id) {
      throw new NotFoundException('User not found');
    }
    return data.id as string;
  }

  @Get('search')
  search(@Query('q') q?: string) {
    return this.growth.search(q ?? '');
  }

  @Get('referrals/me')
  async referral(@CurrentUser() user: FirebaseUser) {
    return this.growth.referralProfile(await this.userId(user.uid));
  }

  @Post('referrals/claim')
  async claim(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { code?: string },
  ) {
    return this.growth.claimReferral(await this.userId(user.uid), body?.code ?? '');
  }

  @Get('notifications')
  async prefs(@CurrentUser() user: FirebaseUser) {
    return this.growth.notificationPrefs(await this.userId(user.uid));
  }

  @Patch('notifications')
  async updatePrefs(
    @CurrentUser() user: FirebaseUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.growth.updateNotificationPrefs(await this.userId(user.uid), body ?? {});
  }

  @Get('history')
  async history(@CurrentUser() user: FirebaseUser) {
    return this.growth.listeningHistory(await this.userId(user.uid));
  }

  @Post('history')
  async record(
    @CurrentUser() user: FirebaseUser,
    @Body()
    body: { songId?: string; title?: string; artistName?: string; artworkUrl?: string },
  ) {
    return this.growth.recordListen(await this.userId(user.uid), body ?? {});
  }

  @Get('favorites')
  async favorites(@CurrentUser() user: FirebaseUser) {
    return this.growth.favorites(await this.userId(user.uid));
  }
}
