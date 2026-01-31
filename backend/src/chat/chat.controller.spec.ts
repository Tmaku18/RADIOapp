import { ChatController } from './chat.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('ChatController', () => {
  it('sends a message using current user info', async () => {
    const chatService = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
      getHistory: jest.fn(),
      getChatStatus: jest.fn(),
    };
    const controller = new ChatController(chatService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-id', display_name: 'User', avatar_url: null },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.sendMessage(
      { uid: 'firebase-uid' } as any,
      { message: 'hi', songId: 'song-1' } as any,
    );

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      'user-id',
      'hi',
      'song-1',
      'User',
      null,
    );
    expect(result).toEqual({ success: true });
  });

  it('returns chat history with mapped fields', async () => {
    const chatService = {
      sendMessage: jest.fn(),
      getHistory: jest.fn().mockResolvedValue([
        {
          id: 'msg-1',
          user_id: 'user-id',
          song_id: 'song-1',
          display_name: 'User',
          avatar_url: null,
          message: 'hello',
          created_at: 'now',
        },
      ]),
      getChatStatus: jest.fn(),
    };
    const controller = new ChatController(chatService as any);

    const result = await controller.getHistory('10');

    expect(result).toEqual({
      messages: [
        {
          id: 'msg-1',
          userId: 'user-id',
          songId: 'song-1',
          displayName: 'User',
          avatarUrl: null,
          message: 'hello',
          createdAt: 'now',
        },
      ],
    });
  });

  it('returns chat status', async () => {
    const chatService = {
      sendMessage: jest.fn(),
      getHistory: jest.fn(),
      getChatStatus: jest.fn().mockResolvedValue({ enabled: true }),
    };
    const controller = new ChatController(chatService as any);

    const result = await controller.getStatus();

    expect(result).toEqual({ enabled: true });
  });
});
