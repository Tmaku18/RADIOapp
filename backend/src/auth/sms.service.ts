import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhone } from './phone-mfa.util';

/**
 * Sends account verification texts through Twilio.
 * Production refuses to pretend a code was sent when Twilio is not configured.
 * Local development logs the code on the API server instead.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  private get sid(): string | undefined {
    return this.config.get<string>('TWILIO_ACCOUNT_SID')?.trim() || undefined;
  }

  private get token(): string | undefined {
    return this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim() || undefined;
  }

  private get from(): string | undefined {
    return this.config.get<string>('TWILIO_FROM_NUMBER')?.trim() || undefined;
  }

  canDeliver(): boolean {
    return Boolean(this.sid && this.token && this.from);
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const body = `NETWORX code: ${code}. It expires in 10 minutes. We will never ask you to share it.`;
    if (!this.canDeliver()) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'Text verification is not set up yet. Try again shortly.',
        );
      }
      this.logger.warn(
        `Twilio is not configured. Verification code for ${maskPhone(to)} is ${code}`,
      );
      return;
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: this.from!,
          Body: body,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Twilio failed for ${maskPhone(to)}: ${response.status} ${errorText}`,
      );
      throw new ServiceUnavailableException(
        'We could not send the text. Check the number and try again.',
      );
    }

    this.logger.log(`Verification text sent to ${maskPhone(to)}`);
  }
}
