import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Emoji allowlist to prevent Redis key explosion and UI clutter.
// Include both ❤ and ❤️ — clients may drop the emoji presentation selector.
export const ALLOWED_EMOJIS = [
  '❤️',
  '❤',
  '🔥',
  '🎵',
  '👏',
  '😍',
  '🙌',
  '💯',
  '✨',
];

export class EmojiReactionDto {
  @IsString()
  @IsIn(ALLOWED_EMOJIS, {
    message: 'Invalid emoji. Allowed: ❤️ 🔥 🎵 👏 😍 🙌 💯 ✨',
  })
  emoji: string;

  /** Station chat channel — clients always send this; must be whitelisted. */
  @IsString()
  @IsOptional()
  @MaxLength(64)
  radioId?: string;
}
