import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to preserve raw body for webhook signature verification.
 *
 * When webhook payloads are received, the raw body must be preserved exactly
 * as it arrived (before JSON parsing) because the signature is computed over
 * the raw bytes, not the re-serialized JSON.
 *
 * This middleware should be applied to webhook routes only.
 * It works in conjunction with NestFactory.create({ rawBody: true }) which
 * enables the rawBody property on all requests.
 *
 * For routes that don't have rawBody enabled globally, this middleware
 * can capture the raw body from the request stream.
 *
 * @see WebhookSignatureGuard
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // If rawBody is already set (via NestJS rawBody option), skip
    if ((req as any).rawBody) {
      next();
      return;
    }

    // Accumulate raw body chunks from the request stream
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length > 0) {
        (req as any).rawBody = Buffer.concat(chunks);
      }
    });

    next();
  }
}

/**
 * Route paths that require raw body preservation for webhook signature verification.
 * These routes will have the RawBodyMiddleware applied.
 */
export const WEBHOOK_ROUTES = [
  '/webhooks/stripe',
  '/webhooks/paypal',
  '/webhooks/callback',
  '/webhooks/*',
];
