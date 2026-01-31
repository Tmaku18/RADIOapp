import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  it('is defined', () => {
    const notificationService = { create: jest.fn() };
    const service = new PushNotificationService(notificationService as any);
    expect(service).toBeDefined();
  });
});
