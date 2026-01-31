import { EmailService } from './email.service';

describe('EmailService', () => {
  it('logs email when provider is console', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'console';
        if (key === 'EMAIL_FROM') return 'noreply@radioapp.com';
        return undefined;
      }),
    };

    const service = new EmailService(configService as any);
    const result = await service.send({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(result).toBe(true);
  });
});
