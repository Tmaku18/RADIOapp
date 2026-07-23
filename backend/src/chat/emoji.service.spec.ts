import { EmojiService } from './emoji.service';
import { isRedisAvailable } from '../config/redis.config';

jest.mock('../config/redis.config', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

describe('EmojiService', () => {
  it('rejects invalid emoji', async () => {
    (isRedisAvailable as jest.Mock).mockResolvedValue(false);
    const chatService = { broadcastEmojiBurst: jest.fn() };
    const service = new EmojiService(chatService as any);
    const result = await service.addReaction('user', '🚫');
    expect(result).toBe(false);
  });
});
