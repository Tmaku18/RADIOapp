import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatAdminService } from './chat-admin.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { getSupabaseClient } from '../config/supabase.config';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatAdmin: ChatAdminService,
  ) {}

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

      const kind = dto.kind === 'comment' ? 'comment' : 'live';
      if (kind === 'comment' && !dto.songId?.trim()) {
        throw new BadRequestException('Comments require a song');
      }

      const result = await this.chatService.sendMessage(
        user.id,
        dto.message,
        dto.songId || null,
        dto.radioId || 'global',
        user.display_name || 'Anonymous',
        user.avatar_url,
        kind,
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

  /** Delete a room message you sent. */
  @Delete('messages/:id')
  async deleteOwnMessage(
    @CurrentUser() firebaseUser: FirebaseUser,
    @Param('id') messageId: string,
  ) {
    const user = await this.getUserInfo(firebaseUser.uid);
    await this.chatAdmin.deleteOwnMessage(user.id, messageId);
    return { ok: true };
  }

  /**
   * Get chat history for hydration. Public read: chat is already broadcast to
   * every listener over Realtime, so reading history needs no auth. This keeps
   * the panel populated even when the viewer's auth token is briefly
   * unavailable (which otherwise surfaced as "Can't reach chat server").
   * GET /api/v1/chat/history
   */
  @Public()
  @Get('history')
  async getHistory(
    @Query('limit') limit?: string,
    @Query('radioId') radioId?: string,
  ) {
    try {
      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 50;
      const messages = await this.chatService.getHistory(
        parsedLimit,
        radioId || 'global',
      );

      return {
        messages: messages.map((m) => this.toClientMessage(m)),
      };
    } catch (err) {
      this.logger.warn(`getHistory failed: ${err?.message || err}`, err?.stack);
      return { messages: [] };
    }
  }

  /**
   * Comments for one song, oldest first. Hidden until that song plays again.
   * GET /api/chat/comments?songId=
   */
  @Public()
  @Get('comments')
  async getComments(
    @Query('songId') songId?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!songId?.trim()) {
        throw new BadRequestException('songId is required');
      }
      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 100;
      const messages = await this.chatService.getComments(
        songId,
        parsedLimit,
      );
      return {
        messages: messages.map((m) => this.toClientMessage(m)),
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(
        `getComments failed: ${err?.message || err}`,
        err?.stack,
      );
      return { messages: [] };
    }
  }

  private toClientMessage(m: {
    id: string;
    user_id: string;
    song_id: string | null;
    radio_id: string;
    display_name: string;
    avatar_url: string | null;
    message: string;
    created_at: string;
    kind?: 'live' | 'comment' | null;
    song_title?: string | null;
    artist_name?: string | null;
  }) {
    return {
      id: m.id,
      userId: m.user_id,
      songId: m.song_id,
      radioId: m.radio_id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      message: m.message,
      createdAt: m.created_at,
      kind: m.kind === 'comment' ? 'comment' : 'live',
      songTitle: m.song_title ?? null,
      artistName: m.artist_name ?? null,
    };
  }

  /**
   * Get chat status (enabled/disabled). Public read — no user context needed.
   * GET /api/v1/chat/status
   */
  @Public()
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
