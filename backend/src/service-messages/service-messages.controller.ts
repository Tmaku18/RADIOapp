import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return data.id;
  }

  @Get('conversations')
  async listConversations(
    @CurrentUser() user: FirebaseUser,
    @Query('search') search?: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.listConversations(userId, search);
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
    @Body()
    body: {
      body?: string;
      requestId?: string | null;
      messageType?: 'text' | 'image' | 'video' | 'voice';
      mediaUrl?: string | null;
      mediaMime?: string | null;
      mediaDurationMs?: number | null;
      replyToMessageId?: string | null;
    },
  ) {
    const messageType = body?.messageType ?? 'text';
    const trimmedBody = body?.body?.trim() ?? '';
    const mediaUrl = body?.mediaUrl?.trim() ?? '';

    if (messageType === 'text' && !trimmedBody) {
      throw new BadRequestException(
        'Message body is required for text messages',
      );
    }
    if (messageType !== 'text' && !mediaUrl) {
      throw new BadRequestException('mediaUrl is required for media messages');
    }

    const userId = await this.getUserId(user.uid);
    return this.service.sendMessage({
      senderId: userId,
      recipientId: otherUserId,
      body: trimmedBody,
      requestId: body.requestId ?? null,
      messageType,
      mediaUrl: mediaUrl || null,
      mediaMime: body.mediaMime ?? null,
      mediaDurationMs: body.mediaDurationMs ?? null,
      replyToMessageId: body.replyToMessageId ?? null,
    });
  }

  @Patch('messages/:messageId')
  async editMessage(
    @CurrentUser() user: FirebaseUser,
    @Param('messageId') messageId: string,
    @Body() body: { body: string },
  ) {
    const trimmed = body?.body?.trim();
    if (!trimmed) {
      throw new BadRequestException('Message body is required');
    }
    const userId = await this.getUserId(user.uid);
    return this.service.editMessage(userId, messageId, trimmed);
  }

  @Post('messages/:messageId/unsend')
  async unsendMessage(
    @CurrentUser() user: FirebaseUser,
    @Param('messageId') messageId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.unsendMessage(userId, messageId);
  }

  @Post('messages/:messageId/reactions')
  async addReaction(
    @CurrentUser() user: FirebaseUser,
    @Param('messageId') messageId: string,
    @Body() body: { emoji: string },
  ) {
    const emoji = body?.emoji?.trim();
    if (!emoji) throw new BadRequestException('emoji is required');
    const userId = await this.getUserId(user.uid);
    return this.service.addReaction(userId, messageId, emoji);
  }

  @Delete('messages/:messageId/reactions')
  async removeReaction(
    @CurrentUser() user: FirebaseUser,
    @Param('messageId') messageId: string,
    @Query('emoji') emoji?: string,
  ) {
    const normalizedEmoji = emoji?.trim();
    if (!normalizedEmoji) throw new BadRequestException('emoji is required');
    const userId = await this.getUserId(user.uid);
    return this.service.removeReaction(userId, messageId, normalizedEmoji);
  }

  @Post('conversations/:otherUserId/read')
  async markThreadRead(
    @CurrentUser() user: FirebaseUser,
    @Param('otherUserId') otherUserId: string,
    @Body() body?: { lastReadMessageId?: string | null },
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.markThreadRead(
      userId,
      otherUserId,
      body?.lastReadMessageId ?? null,
    );
  }

  @Get('unread-summary')
  async getUnreadSummary(@CurrentUser() user: FirebaseUser) {
    const userId = await this.getUserId(user.uid);
    return this.service.getUnreadSummary(userId);
  }

  @Post('conversations/:otherUserId/typing')
  async typingHeartbeat(
    @CurrentUser() user: FirebaseUser,
    @Param('otherUserId') otherUserId: string,
  ) {
    const userId = await this.getUserId(user.uid);
    return this.service.typingHeartbeat(userId, otherUserId);
  }

  @Post('upload-url')
  async getUploadUrl(
    @CurrentUser() user: FirebaseUser,
    @Body() body: { filename: string; contentType: string },
  ) {
    const filename = body?.filename?.trim();
    const contentType = body?.contentType?.trim();
    if (!filename || !contentType) {
      throw new BadRequestException('filename and contentType are required');
    }
    const userId = await this.getUserId(user.uid);
    return this.service.getMediaUploadUrl(userId, filename, contentType);
  }
}
