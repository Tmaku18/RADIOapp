import { BadRequestException } from '@nestjs/common';
import { ServiceMessagesController } from './service-messages.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ServiceMessagesController', () => {
  beforeEach(() => {
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-1' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);
  });

  it('lists conversations', async () => {
    const service = {
      listConversations: jest.fn().mockResolvedValue([]),
    };
    const controller = new ServiceMessagesController(service as any);
    await controller.listConversations({ uid: 'firebase-1' } as any, 'alex');
    expect(service.listConversations).toHaveBeenCalledWith('user-1', 'alex');
  });

  it('rejects empty text messages', async () => {
    const service = { sendMessage: jest.fn() };
    const controller = new ServiceMessagesController(service as any);
    await expect(
      controller.sendMessage({ uid: 'firebase-1' } as any, 'other-1', {
        messageType: 'text',
        body: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a message request', async () => {
    const service = {
      acceptConversation: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new ServiceMessagesController(service as any);
    await controller.acceptConversation(
      { uid: 'firebase-1' } as any,
      'other-1',
    );
    expect(service.acceptConversation).toHaveBeenCalledWith(
      'user-1',
      'other-1',
    );
  });
});
