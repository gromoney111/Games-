import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filter that detects downstream service unavailability errors
 * and returns a proper 503 response with Retry-After header.
 *
 * Handles:
 * - Connection refused (ECONNREFUSED)
 * - Connection timeout (ETIMEDOUT)
 * - DNS resolution failure (ENOTFOUND)
 * - Explicit ServiceUnavailableException
 *
 * Requirements: 17.4
 */
@Catch()
export class ServiceUnavailableFilter implements ExceptionFilter {
  private readonly logger = new Logger('ServiceUnavailableFilter');
  private readonly retryAfterSeconds = 30;

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request as any).correlationId || 'unknown';

    if (this.isServiceUnavailableError(exception)) {
      this.logger.warn(
        `[${correlationId}] Service unavailable: ${exception.message || exception.code || 'unknown error'}`,
      );

      response.setHeader('Retry-After', String(this.retryAfterSeconds));
      response.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again later.',
        },
        timestamp: new Date().toISOString(),
        correlationId,
      });
      return;
    }

    // Re-throw other errors for the global HttpExceptionFilter
    throw exception;
  }

  /**
   * Determines whether an error indicates a downstream service is unavailable.
   */
  private isServiceUnavailableError(error: any): boolean {
    // Node.js network error codes
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.code === 'ENOTFOUND') return true;
    if (error.code === 'ECONNRESET') return true;
    if (error.code === 'EPIPE') return true;
    if (error.code === 'EHOSTUNREACH') return true;

    // Connection error messages
    if (error.message?.includes('connect ECONNREFUSED')) return true;
    if (error.message?.includes('getaddrinfo ENOTFOUND')) return true;
    if (error.message?.includes('socket hang up')) return true;

    // Explicit NestJS ServiceUnavailableException
    if (error instanceof ServiceUnavailableException) return true;
    if (error.name === 'ServiceUnavailableException') return true;

    // Timeout errors (from TimeoutInterceptor)
    if (error.name === 'TimeoutError') return true;

    return false;
  }
}
