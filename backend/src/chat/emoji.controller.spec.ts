import { EmojiController } from './emoji.controller';

describe('EmojiController', () => {
  it('returns false when user is missing', async () => {
    const emojiService = { addReaction: jest.fn() };
    const controller = new EmojiController(emojiService as any);

    const result = await controller.sendEmoji(
      undefined as any,
      { emoji: '🔥' } as any,
    );

    expect(result).toEqual({ success: false });
    expect(emojiService.addReaction).not.toHaveBeenCalled();
  });

  it('sends emoji reaction for current user with radioId', async () => {
    const emojiService = { addReaction: jest.fn().mockResolvedValue(true) };
    const controller = new EmojiController(emojiService as any);

    const result = await controller.sendEmoji(
      { uid: 'user-1' } as any,
      { emoji: '🔥', radioId: 'global' } as any,
    );

    expect(emojiService.addReaction).toHaveBeenCalledWith(
      'user-1',
      '🔥',
      'global',
    );
    expect(result).toEqual({ success: true });
  });
});
