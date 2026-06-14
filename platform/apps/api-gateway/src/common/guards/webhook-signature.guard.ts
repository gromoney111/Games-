import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  WEBHOOK_PROVIDER_KEY,
  WebhookProviderType,
} from '../decorators/webhook.decorator';

/**
 * Guard that validates webhook request signatures from external services.
 *
 * Supports:
 * - Stripe: t=timestamp,v1=signature format with HMAC-SHA256
 * - PayPal: SHA256 signature in x-paypal-signature header
 * - Generic: HMAC-SHA256 signature in x-webhook-signature header
 *
 * Returns 401 Unauthorized for invalid signatures, discarding the payload
 * without processing.
 *
 * Requirement 17.5: Validate webhook request signatures before processing
 * payment and external service callbacks.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  /** Maximum age tolerance for webhook timestamps (5 minutes) */
  private static readonly TIMESTAMP_TOLERANCE_SECONDS = 300;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const provider = this.getWebhookProvider(context);

    switch (provider) {
      case 'stripe':
        return this.validateStripeSignature(request);
      case 'paypal':
        return this.validatePaypalSignature(request);
      case 'generic':
      default:
        return this.validateGenericHMAC(request);
    }
  }

  /**
   * Determine webhook provider from route metadata or request headers.
   */
  private getWebhookProvider(context: ExecutionContext): WebhookProviderType {
    // Check if provider is specified via @WebhookProvider() decorator
    const metadataProvider =
      this.reflector.getAllAndOverride<WebhookProviderType>(
        WEBHOOK_PROVIDER_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (metadataProvider) {
      return metadataProvider;
    }

    // Fallback: detect from request headers
    const request = context.switchToHttp().getRequest();
    if (request.headers['stripe-signature']) {
      return 'stripe';
    }
    if (request.headers['x-paypal-signature']) {
      return 'paypal';
    }

    return 'generic';
  }

  /**
   * Validate Stripe webhook signature.
   *
   * Stripe signs webhooks using HMAC-SHA256 with the format:
   *   stripe-signature: t=timestamp,v1=hex_signature
   *
   * The signed payload is: `${timestamp}.${rawBody}`
   *
   * Includes timestamp tolerance to prevent replay attacks.
   */
  private validateStripeSignature(request: any): boolean {
    const signature = request.headers['stripe-signature'];
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    const payload = this.getRawBody(request);

    if (!signature) {
      this.logger.warn('Stripe webhook missing signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!payload) {
      this.logger.warn('Stripe webhook missing raw body');
      throw new UnauthorizedException('Missing webhook payload');
    }

    if (!secret) {
      this.logger.error(
        'STRIPE_WEBHOOK_SECRET not configured - rejecting webhook',
      );
      throw new UnauthorizedException('Webhook verification not configured');
    }

    // Parse Stripe signature: t=timestamp,v1=signature
    const elements = signature.split(',');
    const timestampElement = elements.find((e: string) => e.startsWith('t='));
    const signatureElement = elements.find((e: string) =>
      e.startsWith('v1='),
    );

    if (!timestampElement || !signatureElement) {
      this.logger.warn('Stripe webhook signature malformed');
      throw new UnauthorizedException('Invalid webhook signature format');
    }

    const timestamp = timestampElement.split('=')[1];
    const sig = signatureElement.split('=')[1];

    if (!timestamp || !sig) {
      throw new UnauthorizedException('Invalid webhook signature format');
    }

    // Verify timestamp is not too old (5-minute tolerance for replay protection)
    const now = Math.floor(Date.now() / 1000);
    const webhookTimestamp = parseInt(timestamp, 10);

    if (isNaN(webhookTimestamp)) {
      throw new UnauthorizedException('Invalid webhook timestamp');
    }

    if (
      Math.abs(now - webhookTimestamp) >
      WebhookSignatureGuard.TIMESTAMP_TOLERANCE_SECONDS
    ) {
      this.logger.warn(
        `Stripe webhook timestamp too old: ${webhookTimestamp} vs ${now}`,
      );
      throw new UnauthorizedException('Webhook timestamp expired');
    }

    // Compute expected signature: HMAC-SHA256(secret, "timestamp.body")
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (!this.timingSafeCompare(sig, expectedSig)) {
      this.logger.warn('Stripe webhook signature mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }

  /**
   * Validate PayPal webhook signature.
   *
   * PayPal signs webhooks using SHA256 with HMAC, sending the signature
   * in the x-paypal-signature header.
   */
  private validatePaypalSignature(request: any): boolean {
    const signature = request.headers['x-paypal-signature'];
    const secret = this.configService.get<string>('PAYPAL_WEBHOOK_SECRET');
    const payload = this.getRawBody(request);

    if (!signature) {
      this.logger.warn('PayPal webhook missing signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!payload) {
      this.logger.warn('PayPal webhook missing raw body');
      throw new UnauthorizedException('Missing webhook payload');
    }

    if (!secret) {
      this.logger.error(
        'PAYPAL_WEBHOOK_SECRET not configured - rejecting webhook',
      );
      throw new UnauthorizedException('Webhook verification not configured');
    }

    // Compute expected signature
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    if (!this.timingSafeCompare(signature, expectedSig)) {
      this.logger.warn('PayPal webhook signature mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }

  /**
   * Validate generic HMAC-SHA256 webhook signature.
   *
   * Uses the x-webhook-signature header with a configurable secret.
   * Supports optional x-webhook-timestamp for replay protection.
   */
  private validateGenericHMAC(request: any): boolean {
    const signature = request.headers['x-webhook-signature'];
    const secret = this.configService.get<string>('WEBHOOK_GENERIC_SECRET');
    const payload = this.getRawBody(request);

    if (!signature) {
      this.logger.warn('Generic webhook missing signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!payload) {
      this.logger.warn('Generic webhook missing raw body');
      throw new UnauthorizedException('Missing webhook payload');
    }

    if (!secret) {
      this.logger.error(
        'WEBHOOK_GENERIC_SECRET not configured - rejecting webhook',
      );
      throw new UnauthorizedException('Webhook verification not configured');
    }

    // Check optional timestamp for replay protection
    const timestamp = request.headers['x-webhook-timestamp'];
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const webhookTimestamp = parseInt(timestamp, 10);

      if (
        !isNaN(webhookTimestamp) &&
        Math.abs(now - webhookTimestamp) >
          WebhookSignatureGuard.TIMESTAMP_TOLERANCE_SECONDS
      ) {
        this.logger.warn(
          `Generic webhook timestamp too old: ${webhookTimestamp} vs ${now}`,
        );
        throw new UnauthorizedException('Webhook timestamp expired');
      }
    }

    // Compute expected signature (include timestamp if present)
    const dataToSign = timestamp ? `${timestamp}.${payload}` : payload;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex');

    // Constant-time comparison
    if (!this.timingSafeCompare(signature, expectedSig)) {
      this.logger.warn('Generic webhook signature mismatch');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }

  /**
   * Extract raw body from request.
   * NestJS with rawBody option stores it as request.rawBody (Buffer).
   */
  private getRawBody(request: any): string | undefined {
    if (request.rawBody) {
      return Buffer.isBuffer(request.rawBody)
        ? request.rawBody.toString('utf8')
        : request.rawBody;
    }
    // Fallback: if the body is present as string
    if (typeof request.body === 'string') {
      return request.body;
    }
    // If body is already parsed JSON, stringify it (less reliable)
    if (request.body && typeof request.body === 'object') {
      return JSON.stringify(request.body);
    }
    return undefined;
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   * Uses crypto.timingSafeEqual when possible, falls back to
   * length-padded comparison.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');

      // timingSafeEqual requires same length buffers
      if (bufA.length !== bufB.length) {
        // Compare against a same-length dummy to avoid timing leaks
        const dummy = Buffer.alloc(bufA.length);
        crypto.timingSafeEqual(bufA, dummy);
        return false;
      }

      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
