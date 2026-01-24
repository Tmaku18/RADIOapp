import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { EmojiService } from './emoji.service';
import { EmojiReactionDto } from './dto/emoji-reaction.dto';

/**
 * Emoji reaction controller for live radio chat.
 * 
 * POST /api/chat/emoji - Send an emoji reaction
 * 
 * Reactions are:
 * - Rate limited (1 per second per user)
 * - Validated against allowlist (8 emojis)
 * - Aggregated and broadcast every 2 seconds
 */
@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class EmojiController {
  constructor(private readonly emojiService: EmojiService) {}

  /**
   * Send an emoji reaction to the current song
   */
  @Post('emoji')
  async sendEmoji(
    @Req() req: any,
    @Body() dto: EmojiReactionDto,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.uid;

    if (!userId) {
      return { success: false };
    }

    const success = await this.emojiService.addReaction(userId, dto.emoji);
    return { success };
  }
}
