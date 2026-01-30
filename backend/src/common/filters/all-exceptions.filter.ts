import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger';
import { SentryService } from '../sentry';

/**
 * Structured error response format
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
  details?: unknown;
}

/**
 * Global exception filter that catches all exceptions and formats them consistently.
 * Logs errors with request context and reports to Sentry.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private logger: LoggerService,
    private sentry: SentryService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId || 'unknown';

    // Determine status code and error details
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerError';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        errorName = (responseObj.error as string) || exception.name;
        details = responseObj.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
    }

    // Build structured error response
    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    if (details) {
      errorResponse.details = details;
    }

    // Log the error with full context
    const is5xx = statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
    const logLevel = is5xx ? 'error' : 'warn';
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.logWithRequestId(
      logLevel,
      `${errorName}: ${message}`,
      requestId,
      'ExceptionFilter',
      {
        statusCode,
        path: request.url,
        method: request.method,
        userId: request.user?.uid,
        stack: is5xx ? stack : undefined,
      },
    );

    // Report to Sentry for 5xx errors
    if (is5xx && exception instanceof Error) {
      this.sentry.captureException(exception, {
        requestId,
        path: request.url,
        method: request.method,
        userId: request.user?.uid,
        statusCode,
      });
    }

    // Send response
    response.status(statusCode).json(errorResponse);
  }
}
