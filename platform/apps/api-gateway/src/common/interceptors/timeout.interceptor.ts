import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

/**
 * Interceptor that enforces a timeout on requests to backend services.
 * If a request takes longer than the configured timeout, it throws a
 * ServiceUnavailableException which is handled by the ServiceUnavailableFilter.
 *
 * Default timeout: 10 seconds (10000ms)
 *
 * Requirements: 17.4
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TimeoutInterceptor');
  private readonly timeoutMs: number;

  constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs || 10000; // Default 10 seconds
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          const request = context.switchToHttp().getRequest();
          const correlationId = (request as any).correlationId || 'unknown';

          this.logger.warn(
            `[${correlationId}] Request timed out after ${this.timeoutMs}ms: ${request.method} ${request.url}`,
          );

          return throwError(
            () =>
              new ServiceUnavailableException(
                'Service request timed out. Please try again later.',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
