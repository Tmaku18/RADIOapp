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

  it('canDeliver is false for the console provider', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'console';
        return undefined;
      }),
    };
    const service = new EmailService(configService as any);
    expect(service.canDeliver()).toBe(false);
  });

  it('sends the TestFlight beta invite with the public join link', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'console';
        if (key === 'EMAIL_FROM') return 'NETWORX Radio <support@networxradio.com>';
        return undefined;
      }),
    };
    const service = new EmailService(configService as any);
    const send = jest.spyOn(service, 'send').mockResolvedValue(true);

    const ok = await service.sendTestFlightBetaInvite('artist@example.com', 'Tanaka');
    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'artist@example.com',
        subject: 'NETWORX Radio is in beta — join TestFlight',
        text: expect.stringContaining('https://testflight.apple.com/join/Pxbsqkww'),
        html: expect.stringContaining('https://testflight.apple.com/join/Pxbsqkww'),
      }),
    );
  });
});
