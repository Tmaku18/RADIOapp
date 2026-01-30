import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

/**
 * Custom logger service using Winston for structured logging.
 * Provides JSON-formatted logs in production for easy parsing by log aggregators.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    this.logger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        isProduction
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({
                  level,
                  message,
                  timestamp,
                  context,
                  requestId,
                  ...meta
                }: {
                  level: string;
                  message: string;
                  timestamp: string;
                  context?: string;
                  requestId?: string;
                  [key: string]: unknown;
                }) => {
                  const ctx =
                    context != null ? `[${String(context)}]` : '';
                  const reqId =
                    requestId != null ? `[${String(requestId)}]` : '';
                  const metaStr = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                  return `${timestamp} ${level} ${ctx}${reqId} ${message}${metaStr}`;
                },
              ),
            ),
      ),
      transports: [new winston.transports.Console()],
      defaultMeta: { service: 'radioapp-backend' },
    });
  }

  /**
   * Log with custom context and metadata
   */
  private formatMessage(
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ) {
    return {
      message,
      context,
      ...meta,
    };
  }

  log(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.info(this.formatMessage(message, context, meta));
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    meta?: Record<string, unknown>,
  ) {
    this.logger.error({
      ...this.formatMessage(message, context, meta),
      stack: trace != null ? String(trace) : undefined,
    });
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.warn(this.formatMessage(message, context, meta));
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.debug(this.formatMessage(message, context, meta));
  }

  verbose(message: string, context?: string, meta?: Record<string, unknown>) {
    this.logger.verbose(this.formatMessage(message, context, meta));
  }

  /**
   * Log with request ID for distributed tracing
   */
  logWithRequestId(
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string,
    requestId: string,
    context?: string,
    meta?: Record<string, unknown>,
  ) {
    this.logger[level]({
      message,
      requestId,
      context,
      ...meta,
    });
  }

  /**
   * Log HTTP request details
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    requestId: string,
    userId?: string,
  ) {
    this.logger.info({
      message: `${method} ${url} ${statusCode} ${duration}ms`,
      type: 'http_request',
      method,
      url,
      statusCode,
      duration,
      requestId,
      userId,
    });
  }
}
