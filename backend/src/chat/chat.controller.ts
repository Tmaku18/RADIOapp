import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /**
   * Get user info from Firebase UID
   */
  private async getUserInfo(firebaseUid: string) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (!data) {
      throw new Error('User not found');
    }

    return data;
  }

  /**
   * Send a chat message (Backend Gatekeeper)
   * POST /api/v1/chat/send
   */
  @Post('send')
  async sendMessage(
    @CurrentUser() firebaseUser: FirebaseUser,
    @Body() dto: SendMessageDto,
  ) {
    try {
      const user = await this.getUserInfo(firebaseUser.uid);

      const result = await this.chatService.sendMessage(
        user.id,
        dto.message,
        dto.songId || null,
        user.display_name || 'Anonymous',
        user.avatar_url,
      );

      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to send message';
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(`Chat send failed: ${message}`);
      throw new BadRequestException(message);
    }
  }

  /**
   * Get chat history for hydration
   * GET /api/v1/chat/history
   */
  @Get('history')
  async getHistory(@Query('limit') limit?: string) {
    try {
      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
      const messages = await this.chatService.getHistory(parsedLimit);

      return {
        messages: messages.map((m) => ({
          id: m.id,
          userId: m.user_id,
          songId: m.song_id,
          displayName: m.display_name,
          avatarUrl: m.avatar_url,
          message: m.message,
          createdAt: m.created_at,
        })),
      };
    } catch (err) {
      this.logger.warn(`getHistory failed: ${err?.message || err}`, err?.stack);
      return { messages: [] };
    }
  }

  /**
   * Get chat status (enabled/disabled)
   * GET /api/v1/chat/status
   */
  @Get('status')
  async getStatus() {
    try {
      return await this.chatService.getChatStatus();
    } catch (err) {
      this.logger.warn(`getStatus failed: ${err?.message || err}`, err?.stack);
      return { enabled: false };
    }
  }
}
