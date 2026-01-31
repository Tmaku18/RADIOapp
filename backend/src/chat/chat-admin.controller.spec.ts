import { ChatAdminController } from './chat-admin.controller';

describe('ChatAdminController', () => {
  it('toggles chat', async () => {
    const chatAdminService = {
      toggleChat: jest.fn().mockResolvedValue({ enabled: false }),
      shadowBanUser: jest.fn(),
      unbanUser: jest.fn(),
      getShadowBannedUsers: jest.fn(),
      deleteMessage: jest.fn(),
    };
    const controller = new ChatAdminController(chatAdminService as any);

    const result = await controller.toggleChat({ enabled: false, reason: 'test' });

    expect(chatAdminService.toggleChat).toHaveBeenCalledWith(false, 'test');
    expect(result).toEqual({ enabled: false });
  });

  it('shadow bans a user', async () => {
    const chatAdminService = {
      toggleChat: jest.fn(),
      shadowBanUser: jest.fn().mockResolvedValue({ success: true }),
      unbanUser: jest.fn(),
      getShadowBannedUsers: jest.fn(),
      deleteMessage: jest.fn(),
    };
    const controller = new ChatAdminController(chatAdminService as any);

    const result = await controller.shadowBanUser('user-1', { durationHours: 2 });

    expect(chatAdminService.shadowBanUser).toHaveBeenCalledWith('user-1', 2);
    expect(result).toEqual({ success: true });
  });
});
