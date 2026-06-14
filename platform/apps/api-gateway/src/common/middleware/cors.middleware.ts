import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * CORS Middleware for strict origin whitelist enforcement.
 * Validates incoming request origins against the configured whitelist.
 * This middleware provides additional CORS validation beyond NestJS's
 * built-in CORS support for security-critical endpoints.
 */
@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly allowedOrigins: string[];

  constructor(private readonly configService: ConfigService) {
    this.allowedOrigins = [
      this.configService.get<string>('app.frontendUrl') || 'http://localhost:3001',
      this.configService.get<string>('app.adminUrl') || 'http://localhost:3002',
    ].filter(Boolean);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    if (origin && this.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Correlation-ID, X-Requested-With',
      );
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-Correlation-ID, X-RateLimit-Remaining, Retry-After',
      );
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}
