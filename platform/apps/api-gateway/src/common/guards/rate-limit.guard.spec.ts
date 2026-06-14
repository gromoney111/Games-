import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard, RedisClientInterface } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let configService: ConfigService;
  let redisClient: jest.Mocked<RedisClientInterface>;

  const mockRequest = (overrides: any = {}) => ({
    user: { userId: 'user-123', email: 'test@example.com', role: 'player' },
    ip: '127.0.0.1',
    headers: {},
    connection: { remoteAddress: '127.0.0.1' },
    ...overrides,
  });

  const mockResponse = () => {
    const headers: Record<string, string> = {};
    return {
      setHeader: jest.fn((key: string, value: string) => {
        headers[key] = value;
      }),
      getHeaders: () => headers,
    };
  };

  const mockExecutionContext = (
    request: any,
    response: any,
    handlerName = 'testMethod',
    className = 'TestController',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => {
        const fn = function () {};
        Object.defineProperty(fn, 'name', { value: handlerName });
        return fn;
      },
      getClass: () => {
        const cls = function () {};
        Object.defineProperty(cls, 'name', { value: className });
        return cls;
      },
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'app.rateLimit.maxRequests': 100,
          'app.rateLimit.windowMs': 60000,
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    redisClient = {
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    guard = new RateLimitGuard(reflector, configService, redisClient);
  });

  describe('canActivate', () => {
    it('should allow requests within the rate limit', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zcard.mockResolvedValue(50);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisClient.zremrangebyscore).toHaveBeenCalled();
      expect(redisClient.zadd).toHaveBeenCalled();
      expect(redisClient.expire).toHaveBeenCalled();
    });

    it('should set X-RateLimit headers on successful requests', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zcard.mockResolvedValue(10);

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '89');
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String),
      );
    });

    it('should throw 429 when rate limit is exceeded', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zcard.mockResolvedValue(100); // At limit
      redisClient.zrange.mockResolvedValue([
        'entry',
        String(Date.now() - 30000), // 30 seconds ago
      ]);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it('should include Retry-After header when rate limit is exceeded', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zcard.mockResolvedValue(100);
      redisClient.zrange.mockResolvedValue([
        'entry',
        String(Date.now() - 30000),
      ]);

      try {
        await guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(response.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(String),
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '0',
      );
    });

    it('should skip rate limiting for public routes', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      // First call checks SKIP_RATE_LIMIT_KEY, second checks IS_PUBLIC_KEY
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined) // SKIP_RATE_LIMIT_KEY
        .mockReturnValueOnce(true); // IS_PUBLIC_KEY

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisClient.zcard).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for @SkipRateLimit() routes', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(true); // SKIP_RATE_LIMIT_KEY

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisClient.zcard).not.toHaveBeenCalled();
    });

    it('should use IP address for unauthenticated requests', async () => {
      const request = mockRequest({ user: undefined });
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      await guard.canActivate(context);

      // The Redis key should contain the IP instead of userId
      const addedKey = redisClient.zremrangebyscore.mock.calls[0][0];
      expect(addedKey).toContain('127.0.0.1');
    });

    it('should use custom rate limits from @RateLimit() decorator', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined) // SKIP_RATE_LIMIT_KEY
        .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
        .mockReturnValueOnce({ maxRequests: 10, windowSeconds: 30 }); // RATE_LIMIT_KEY

      redisClient.zcard.mockResolvedValue(10); // At custom limit

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should allow requests when below custom rate limits', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(undefined) // SKIP_RATE_LIMIT_KEY
        .mockReturnValueOnce(undefined) // IS_PUBLIC_KEY
        .mockReturnValueOnce({ maxRequests: 200, windowSeconds: 60 }); // RATE_LIMIT_KEY

      redisClient.zcard.mockResolvedValue(100); // Below custom limit of 200

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '200');
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
    });

    it('should fail-open when Redis is unavailable', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zremrangebyscore.mockRejectedValue(
        new Error('Redis connection refused'),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should use x-forwarded-for header for proxy IP detection', async () => {
      const request = mockRequest({
        user: undefined,
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      });
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      await guard.canActivate(context);

      const addedKey = redisClient.zremrangebyscore.mock.calls[0][0];
      expect(addedKey).toContain('203.0.113.50');
    });

    it('should use separate rate limit keys per endpoint', async () => {
      const request = mockRequest();
      const response = mockResponse();

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context1 = mockExecutionContext(
        request,
        response,
        'getGames',
        'GamesController',
      );
      await guard.canActivate(context1);

      const context2 = mockExecutionContext(
        request,
        response,
        'getProfile',
        'UsersController',
      );
      await guard.canActivate(context2);

      const key1 = redisClient.zremrangebyscore.mock.calls[0][0];
      const key2 = redisClient.zremrangebyscore.mock.calls[1][0];
      expect(key1).not.toEqual(key2);
      expect(key1).toContain('GamesController:getGames');
      expect(key2).toContain('UsersController:getProfile');
    });

    it('should set remaining to 0 when exactly at limit minus one', async () => {
      const request = mockRequest();
      const response = mockResponse();
      const context = mockExecutionContext(request, response);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      redisClient.zcard.mockResolvedValue(99); // 99 requests, 1 remaining

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    });
  });
});
