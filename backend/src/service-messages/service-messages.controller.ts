import { BadRequestException, Body, Controller, Get, Param, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ServiceMessagesService } from './service-messages.service';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('messages')
@UseGuards(FirebaseAuthGuard)
export class ServiceMessagesController {
  constructor(private readonly service: ServiceMessagesService) {}

  private async getUserId(firebaseUid: string): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('id').eq('firebase_uid', firebaseUid).single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('conversations')
  async listConversations(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.service.listConversations(userId);
  }

  @Get('conversations/:otherUserId')
  async getThread(
    @CurrentUser() user: FirebaseUser,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limitStr?: string,
    @Query('before') before?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 100) : 50;
    return this.service.getThread(userId, otherUserId, limit, before);
  }

  @Post('conversations/:otherUserId')
  async sendMessage(
    @CurrentUser() user: FirebaseUser,
    @Param('otherUserId') otherUserId: string,
    @Body() body: { body: string; requestId?: string | null },
  ) {
    if (!body?.body?.trim()) {
      throw new BadRequestException('Message body is required');
    }
    const userId = await this.getUserId(user.uid);
    return this.service.sendMessage(userId, otherUserId, body.body.trim(), body.requestId ?? null);
  }
}
