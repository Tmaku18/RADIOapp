import { EmojiService } from './emoji.service';
import { isRedisAvailable } from '../config/redis.config';

jest.mock('../config/redis.config', () => ({
  getRedisClient: jest.fn(),
  isRedisAvailable: jest.fn(),
}));

describe('EmojiService', () => {
  it('rejects invalid emoji', async () => {
    (isRedisAvailable as jest.Mock).mockResolvedValue(false);
    const service = new EmojiService();
    const result = await service.addReaction('user', '🚫');
    expect(result).toBe(false);
  });
});
