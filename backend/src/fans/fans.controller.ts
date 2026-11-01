import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { FanEmailDto } from './fans.dto';
import { FansService } from './fans.service';

@Controller('fans')
export class FansController {
  constructor(private readonly fans: FansService) {}

  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async mine(@CurrentUser() user: FirebaseUser) {
    return this.fans.listForArtist(await this.userId(user.uid));
  }

  @Delete('me/:fanId')
  @UseGuards(FirebaseAuthGuard)
  async remove(
    @CurrentUser() user: FirebaseUser,
    @Param('fanId') fanId: string,
  ) {
    return this.fans.remove(await this.userId(user.uid), fanId);
  }

  @Post(':artistId')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async subscribe(
    @Param('artistId') artistId: string,
    @Body() body: FanEmailDto,
  ) {
    const result = await this.fans.subscribe(artistId, body.email);
    if (!result.subscribed) {
      throw new BadRequestException('Enter a valid email.');
    }
    return result;
  }

  private async userId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();
    if (!data?.id) throw new NotFoundException('User not found');
    return data.id as string;
  }
}
