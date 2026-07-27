import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Email service for sending notifications.
 *
 * Configure by setting EMAIL_PROVIDER and appropriate API keys:
 * - For SendGrid: SENDGRID_API_KEY
 * - For Resend: RESEND_API_KEY
 *
 * If no provider is configured, emails are logged to console (dev mode).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.provider =
      this.configService.get<string>('EMAIL_PROVIDER') || 'console';
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') || 'noreply@radioapp.com';
  }

  async send(options: SendEmailOptions): Promise<boolean> {
    try {
      switch (this.provider) {
        case 'sendgrid':
          return await this.sendWithSendGrid(options);
        case 'resend':
          return await this.sendWithResend(options);
        default:
          return this.logEmail(options);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      return false;
    }
  }

  private async sendWithSendGrid(options: SendEmailOptions): Promise<boolean> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not configured');
      return this.logEmail(options);
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: this.fromEmail },
        subject: options.subject,
        content: [
          options.html
            ? { type: 'text/html', value: options.html }
            : { type: 'text/plain', value: options.text || '' },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${error}`);
    }

    this.logger.log(`Email sent via SendGrid to ${options.to}`);
    return true;
  }

  private async sendWithResend(options: SendEmailOptions): Promise<boolean> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured');
      return this.logEmail(options);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend error: ${error}`);
    }

    this.logger.log(`Email sent via Resend to ${options.to}`);
    return true;
  }

  private logEmail(options: SendEmailOptions): boolean {
    this.logger.log(`[DEV] Email to ${options.to}:`);
    this.logger.log(`  Subject: ${options.subject}`);
    this.logger.log(
      `  Body: ${options.text || options.html?.substring(0, 100)}...`,
    );
    return true;
  }

  // Predefined email templates

  async sendSongApprovedEmail(to: string, songTitle: string): Promise<boolean> {
    return this.send({
      to,
      subject: `Your song "${songTitle}" has been approved!`,
      html: `
        <h2>Good news!</h2>
        <p>Your song <strong>${songTitle}</strong> has been approved and is now live on RadioApp.</p>
        <p>Don't forget to allocate credits to get airtime!</p>
        <p><a href="https://radioapp.com/artist/songs">Manage your songs</a></p>
        <br>
        <p>- The RadioApp Team</p>
      `,
      text: `Your song "${songTitle}" has been approved and is now live on RadioApp. Don't forget to allocate credits to get airtime!`,
    });
  }

  async sendSongRejectedEmail(
    to: string,
    songTitle: string,
    reason?: string,
  ): Promise<boolean> {
    const detail =
      reason?.trim() ||
      'No detailed reason was provided. Contact support for clarification.';
    return this.send({
      to,
      subject: `Your song "${songTitle}" was not approved`,
      html: `
        <h2>Song not approved</h2>
        <p>We've reviewed your song <strong>${songTitle}</strong> and it was not approved for Networx Radio.</p>
        <p><strong>Why it was rejected:</strong></p>
        <p style="background:#f8f8f8;padding:12px;border-radius:8px;white-space:pre-wrap;">${detail}</p>
        <p>You can fix the issue and upload again, or contact support within <strong>48 hours</strong> if you believe this was a mistake.</p>
        <p>After 48 hours, the rejected song may be automatically removed.</p>
        <p><a href="mailto:support@radioapp.com">Contact Support</a></p>
        <br>
        <p>- The Networx Team</p>
      `,
      text: `Your song "${songTitle}" was not approved.\n\nWhy it was rejected:\n${detail}\n\nYou can fix the issue and upload again, or contact support@radioapp.com within 48 hours if you believe this was a mistake.`,
    });
  }

  async sendAdminNewSongUploadEmail(
    to: string,
    params: {
      songTitle: string;
      artistName: string;
      artistEmail?: string | null;
      songId: string;
    },
  ): Promise<boolean> {
    const artistLine = params.artistEmail
      ? `${params.artistName} &lt;${params.artistEmail}&gt;`
      : params.artistName;
    return this.send({
      to,
      subject: `[Admin] New song pending review: "${params.songTitle}"`,
      html: `
        <h2>New song pending review</h2>
        <p><strong>${params.songTitle}</strong> was uploaded and is waiting for approval.</p>
        <ul>
          <li><strong>Artist:</strong> ${artistLine}</li>
          <li><strong>Song ID:</strong> ${params.songId}</li>
        </ul>
        <p>Open the admin songs queue to approve or reject with a clear explanation for the artist.</p>
        <br>
        <p>- Networx Admin Alerts</p>
      `,
      text: `New song pending review: "${params.songTitle}" by ${params.artistName}${
        params.artistEmail ? ` (${params.artistEmail})` : ''
      }. Song ID: ${params.songId}. Open Admin → Songs to review.`,
    });
  }

  async sendAdminSongRejectedEmail(
    to: string,
    params: {
      songTitle: string;
      artistName: string;
      artistEmail?: string | null;
      reason: string;
      songId: string;
    },
  ): Promise<boolean> {
    const artistLine = params.artistEmail
      ? `${params.artistName} &lt;${params.artistEmail}&gt;`
      : params.artistName;
    return this.send({
      to,
      subject: `[Admin] Song rejected: "${params.songTitle}"`,
      html: `
        <h2>Song rejected</h2>
        <p><strong>${params.songTitle}</strong> by ${artistLine} was rejected.</p>
        <p><strong>Reason shared with the artist:</strong></p>
        <p style="background:#f8f8f8;padding:12px;border-radius:8px;white-space:pre-wrap;">${params.reason}</p>
        <p>Song ID: ${params.songId}</p>
        <br>
        <p>- Networx Admin Alerts</p>
      `,
      text: `Song rejected: "${params.songTitle}" by ${params.artistName}. Reason: ${params.reason}. Song ID: ${params.songId}`,
    });
  }
}
