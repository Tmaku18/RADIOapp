import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { LoggerService } from '../logger';

/**
 * Service for initializing and interacting with Sentry error reporting.
 * Captures exceptions and transactions for monitoring.
 */
@Injectable()
export class SentryService implements OnModuleInit {
  private isInitialized = false;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV') || 'development';

    if (!dsn) {
      this.logger.warn(
        'Sentry DSN not configured. Error reporting is disabled.',
        'SentryService',
      );
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment,
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        integrations: [
          Sentry.httpIntegration(),
        ],
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          return event;
        },
      });

      this.isInitialized = true;
      this.logger.log(
        `Sentry initialized for environment: ${environment}`,
        'SentryService',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Sentry',
        error instanceof Error ? error.stack : String(error),
        'SentryService',
      );
    }
  }

  /**
   * Capture an exception and send to Sentry
   */
  captureException(error: Error, context?: Record<string, unknown>) {
    if (!this.isInitialized) {
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  }

  /**
   * Capture a message (non-exception) and send to Sentry
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>) {
    if (!this.isInitialized) {
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Set user context for error tracking
   */
  setUser(user: { id: string; email?: string; role?: string }) {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Clear user context (on logout)
   */
  clearUser() {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
    if (!this.isInitialized) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }
}
