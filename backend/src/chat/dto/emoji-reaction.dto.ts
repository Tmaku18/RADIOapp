import { IsString, IsIn } from 'class-validator';

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
}
