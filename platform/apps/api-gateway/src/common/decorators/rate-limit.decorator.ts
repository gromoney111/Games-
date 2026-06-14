import { SetMetadata } from '@nestjs/common';

/**
 * Rate limit metadata key used by the RateLimitGuard to retrieve
 * per-endpoint rate limit configuration.
 */
export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Configuration for the @RateLimit() decorator.
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

/**
 * Decorator to apply custom rate limits to specific endpoints or controllers.
 * Overrides the global default rate limit (100 req/min).
 *
 * @param maxRequests - Maximum number of requests allowed in the time window
 * @param windowSeconds - Time window duration in seconds (default: 60)
 *
 * @example
 * // Allow 10 requests per 60 seconds for a sensitive endpoint
 * @RateLimit(10, 60)
 * @Post('auth/login')
 * login(@Body() dto: LoginDto) { ... }
 *
 * @example
 * // Allow 200 requests per 60 seconds for a high-traffic endpoint
 * @RateLimit(200, 60)
 * @Get('games')
 * listGames() { ... }
 */
export const RateLimit = (maxRequests: number, windowSeconds: number = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { maxRequests, windowSeconds } as RateLimitOptions);

/**
 * Metadata key to skip rate limiting for specific endpoints.
 */
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Decorator to skip rate limiting for specific endpoints.
 * Useful for health checks and public status endpoints.
 *
 * @example
 * @SkipRateLimit()
 * @Get('health')
 * healthCheck() { ... }
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
