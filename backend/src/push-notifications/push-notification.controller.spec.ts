import { PushNotificationController } from './push-notification.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('PushNotificationController', () => {
  it('registers device token', async () => {
    const pushNotificationService = {
      registerDeviceToken: jest.fn().mockResolvedValue({ success: true }),
      unregisterDeviceToken: jest.fn(),
      getUserDevices: jest.fn(),
    };
    const controller = new PushNotificationController(pushNotificationService as any);
    const supabase = createSupabaseMock();

    supabase.__builder.single.mockResolvedValue({ data: { id: 'user-id' }, error: null });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    const result = await controller.registerDevice(
      { uid: 'firebase-uid' } as any,
      { fcmToken: 'token', deviceType: 'ios' } as any,
    );

    expect(pushNotificationService.registerDeviceToken).toHaveBeenCalledWith(
      'user-id',
      'token',
      'ios',
    );
    expect(result).toEqual({ success: true });
  });
});
