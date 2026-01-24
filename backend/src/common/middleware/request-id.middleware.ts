import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../logger';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware that assigns a unique request ID to each incoming request.
 * If the client provides an x-request-id header, it will be used; otherwise, a new UUID is generated.
 * This enables distributed tracing across services.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Use existing request ID from header or generate new one
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || uuidv4();
    
    // Attach to request object for use in handlers
    req.requestId = requestId;
    req.startTime = Date.now();
    
    // Set response header for client correlation
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Log request start
    this.logger.logWithRequestId(
      'debug',
      `Incoming request: ${req.method} ${req.originalUrl}`,
      requestId,
      'RequestIdMiddleware',
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    );

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;
      const userId = (req as any).user?.uid; // From Firebase auth if available
      
      this.logger.logRequest(
        req.method,
        req.originalUrl,
        res.statusCode,
        duration,
        requestId,
        userId,
      );
    });

    next();
  }
}
