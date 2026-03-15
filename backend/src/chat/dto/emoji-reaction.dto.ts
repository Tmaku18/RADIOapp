import { IsString, IsIn } from 'class-validator';

// Emoji allowlist to prevent Redis key explosion and UI clutter
export const ALLOWED_EMOJIS = ['❤️', '🔥', '🎵', '👏', '😍', '🙌', '💯', '✨'];

export class EmojiReactionDto {
  @IsString()
  @IsIn(ALLOWED_EMOJIS, {
    message: 'Invalid emoji. Allowed: ❤️ 🔥 🎵 👏 😍 🙌 💯 ✨',
  })
  emoji: string;
}
