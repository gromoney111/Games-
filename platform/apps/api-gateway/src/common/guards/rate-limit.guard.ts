import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Token for injecting the Redis client into the RateLimitGuard.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Interface for the Redis client used by the rate limiter.
 * Compatible with ioredis client.
 */
export interface RedisClientInterface {
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  zrange(key: string, start: number, stop: number, ...args: string[]): Promise<string[]>;
  zadd(key: string, score: number, member: string): Promise<number | string>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * RateLimitGuard implements a sliding window rate limiter using Redis sorted sets.
 *
 * Algorithm:
 * 1. Uses Redis ZSET with timestamps as scores
 * 2. Removes entries outside the current time window
 * 3. Counts remaining entries to determine request count
 * 4. Rejects request if count exceeds max allowed
 * 5. Adds current request timestamp to the sorted set
 *
 * Features:
 * - Per-user rate limiting (authenticated users by userId, anonymous by IP)
 * - Configurable limits per endpoint via @RateLimit() decorator
 * - Proper HTTP 429 response with Retry-After header
 * - X-RateLimit-* headers on all responses
 * - Skips rate limiting for health checks and @SkipRateLimit() endpoints
 *
 * Requirements: 17.2, 17.3
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly defaultMaxRequests: number;
  private readonly defaultWindowMs: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClientInterface,
  ) {
    this.defaultMaxRequests = this.configService.get<number>(
      'app.rateLimit.maxRequests',
      100,
    );
    this.defaultWindowMs = this.configService.get<number>(
      'app.rateLimit.windowMs',
      60000,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting should be skipped
    if (this.shouldSkipRateLimit(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Determine rate limit configuration (per-endpoint or global default)
    const rateLimitConfig = this.getRateLimitConfig(context);
    const maxRequests = rateLimitConfig.maxRequests;
    const windowMs = rateLimitConfig.windowSeconds * 1000;

    // Identify the user: authenticated userId or fallback to IP
    const userId = request.user?.userId || this.getClientIp(request);

    // Build Redis key with endpoint-specific suffix for separate limits
    const endpointKey = this.getEndpointKey(context);
    const key = `rate_limit:${userId}:${endpointKey}`;

    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      // Step 1: Remove entries outside the current window
      await this.redisClient.zremrangebyscore(key, 0, windowStart);

      // Step 2: Count requests in current window
      const count = await this.redisClient.zcard(key);

      if (count >= maxRequests) {
        // Rate limit exceeded - calculate Retry-After
        const retryAfterSeconds = await this.calculateRetryAfter(
          key,
          windowMs,
          now,
        );

        // Set rate limit headers
        response.setHeader('X-RateLimit-Limit', String(maxRequests));
        response.setHeader('X-RateLimit-Remaining', '0');
        response.setHeader(
          'X-RateLimit-Reset',
          String(Math.ceil((now + retryAfterSeconds * 1000) / 1000)),
        );
        response.setHeader('Retry-After', String(retryAfterSeconds));

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too Many Requests',
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter: retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Step 3: Add current request to the sorted set
      const uniqueMember = `${now}:${crypto.randomUUID()}`;
      await this.redisClient.zadd(key, now, uniqueMember);

      // Step 4: Set key expiry to auto-cleanup (window duration + buffer)
      await this.redisClient.expire(key, Math.ceil(windowMs / 1000) + 1);

      // Step 5: Set rate limit headers on successful requests
      const remaining = maxRequests - count - 1;
      response.setHeader('X-RateLimit-Limit', String(maxRequests));
      response.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
      response.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil((now + windowMs) / 1000)),
      );

      return true;
    } catch (error) {
      // Re-throw HttpExceptions (rate limit exceeded)
      if (error instanceof HttpException) {
        throw error;
      }

      // On Redis failure, allow the request through (fail-open)
      // Log the error for monitoring but don't block users
      console.error('[RateLimitGuard] Redis error, allowing request:', error);
      return true;
    }
  }

  /**
   * Determine if rate limiting should be skipped for this request.
   * Skips for:
   * - Public routes (health checks, etc.)
   * - Routes with @SkipRateLimit() decorator
   */
  private shouldSkipRateLimit(context: ExecutionContext): boolean {
    // Check @SkipRateLimit() decorator
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipRateLimit) {
      return true;
    }

    // Check @Public() decorator - public routes are typically health/status endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    return false;
  }

  /**
   * Get rate limit configuration from the @RateLimit() decorator or use global defaults.
   */
  private getRateLimitConfig(context: ExecutionContext): {
    maxRequests: number;
    windowSeconds: number;
  } {
    const config = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (config) {
      return config;
    }

    return {
      maxRequests: this.defaultMaxRequests,
      windowSeconds: Math.ceil(this.defaultWindowMs / 1000),
    };
  }

  /**
   * Generate an endpoint-specific key segment for separate rate limits.
   * Format: "ControllerName:methodName"
   */
  private getEndpointKey(context: ExecutionContext): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    return `${controller}:${handler}`;
  }

  /**
   * Extract client IP address from request, accounting for proxies.
   */
  private getClientIp(request: any): string {
    return (
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers?.['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Calculate the Retry-After value in seconds.
   * Based on when the oldest entry in the window will expire.
   */
  private async calculateRetryAfter(
    key: string,
    windowMs: number,
    now: number,
  ): Promise<number> {
    try {
      const oldestEntries = await this.redisClient.zrange(
        key,
        0,
        0,
        'WITHSCORES',
      );

      if (oldestEntries.length >= 2) {
        const oldestTimestamp = parseInt(oldestEntries[1], 10);
        const expiryTime = oldestTimestamp + windowMs;
        const retryAfter = Math.ceil((expiryTime - now) / 1000);
        return Math.max(1, retryAfter);
      }
    } catch {
      // Fallback on Redis error
    }

    // Default: full window duration
    return Math.ceil(windowMs / 1000);
  }
}
