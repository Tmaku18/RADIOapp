import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
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
   * Send an emoji reaction to the current song / station chat channel
   */
  @Post('emoji')
  async sendEmoji(
    @CurrentUser() user: FirebaseUser,
    @Body() dto: EmojiReactionDto,
  ): Promise<{ success: boolean }> {
    if (!user?.uid) {
      return { success: false };
    }

    const success = await this.emojiService.addReaction(
      user.uid,
      dto.emoji,
      dto.radioId,
    );
    return { success };
  }
}
