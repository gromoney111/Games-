import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { WEBHOOK_PROVIDER_KEY } from '../decorators/webhook.decorator';

describe('WebhookSignatureGuard', () => {
  let guard: WebhookSignatureGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const STRIPE_SECRET = 'whsec_test_stripe_secret_key';
  const PAYPAL_SECRET = 'paypal_test_webhook_secret';
  const GENERIC_SECRET = 'generic_test_webhook_secret';

  beforeEach(() => {
    reflector = new Reflector();
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'STRIPE_WEBHOOK_SECRET':
            return STRIPE_SECRET;
          case 'PAYPAL_WEBHOOK_SECRET':
            return PAYPAL_SECRET;
          case 'WEBHOOK_GENERIC_SECRET':
            return GENERIC_SECRET;
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService;

    guard = new WebhookSignatureGuard(reflector, configService);
  });

  function createMockContext(
    request: any,
    metadataProvider?: string,
  ): ExecutionContext {
    const mockHandler = jest.fn();
    const mockClass = jest.fn();

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === WEBHOOK_PROVIDER_KEY) {
        return metadataProvider;
      }
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => mockHandler,
      getClass: () => mockClass,
    } as unknown as ExecutionContext;
  }

  function generateStripeSignature(
    payload: string,
    secret: string,
    timestamp?: number,
  ): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payload}`;
    const sig = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `t=${ts},v1=${sig}`;
  }

  function generatePaypalSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  function generateGenericSignature(
    payload: string,
    secret: string,
    timestamp?: string,
  ): string {
    const dataToSign = timestamp ? `${timestamp}.${payload}` : payload;
    return crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
  }

  describe('Stripe webhook validation', () => {
    it('should accept a valid Stripe webhook signature', async () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const signature = generateStripeSignature(payload, STRIPE_SECRET);

      const request = {
        headers: { 'stripe-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'stripe');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject a Stripe webhook with invalid signature', async () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const signature = generateStripeSignature(
        payload,
        'wrong_secret_entirely',
      );

      const request = {
        headers: { 'stripe-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a Stripe webhook with missing signature header', async () => {
      const request = {
        headers: {},
        rawBody: Buffer.from('{}'),
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a Stripe webhook with expired timestamp (> 5 min)', async () => {
      const payload = JSON.stringify({ type: 'payment_intent.succeeded' });
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
      const signature = generateStripeSignature(
        payload,
        STRIPE_SECRET,
        oldTimestamp,
      );

      const request = {
        headers: { 'stripe-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should accept a Stripe webhook within the 5-minute tolerance', async () => {
      const payload = JSON.stringify({ type: 'charge.succeeded' });
      const recentTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
      const signature = generateStripeSignature(
        payload,
        STRIPE_SECRET,
        recentTimestamp,
      );

      const request = {
        headers: { 'stripe-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'stripe');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject a Stripe webhook with malformed signature format', async () => {
      const request = {
        headers: { 'stripe-signature': 'invalid_format_no_t_or_v1' },
        rawBody: Buffer.from('{}'),
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when rawBody is missing', async () => {
      const signature = 't=12345,v1=abc123';
      const request = {
        headers: { 'stripe-signature': signature },
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      const payload = '{}';
      const request = {
        headers: { 'stripe-signature': 't=123,v1=abc' },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'stripe');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('PayPal webhook validation', () => {
    it('should accept a valid PayPal webhook signature', async () => {
      const payload = JSON.stringify({ event_type: 'PAYMENT.COMPLETED' });
      const signature = generatePaypalSignature(payload, PAYPAL_SECRET);

      const request = {
        headers: { 'x-paypal-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'paypal');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject a PayPal webhook with invalid signature', async () => {
      const payload = JSON.stringify({ event_type: 'PAYMENT.COMPLETED' });
      const invalidSig = generatePaypalSignature(payload, 'wrong_secret');

      const request = {
        headers: { 'x-paypal-signature': invalidSig },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'paypal');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a PayPal webhook with missing signature', async () => {
      const request = {
        headers: {},
        rawBody: Buffer.from('{}'),
      };

      const context = createMockContext(request, 'paypal');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Generic HMAC webhook validation', () => {
    it('should accept a valid generic webhook signature', async () => {
      const payload = JSON.stringify({ event: 'test.event' });
      const signature = generateGenericSignature(payload, GENERIC_SECRET);

      const request = {
        headers: { 'x-webhook-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'generic');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should accept a valid generic webhook with timestamp', async () => {
      const payload = JSON.stringify({ event: 'test.event' });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateGenericSignature(
        payload,
        GENERIC_SECRET,
        timestamp,
      );

      const request = {
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
        },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'generic');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject a generic webhook with invalid signature', async () => {
      const payload = JSON.stringify({ event: 'test.event' });
      const invalidSig = generateGenericSignature(payload, 'wrong_key');

      const request = {
        headers: { 'x-webhook-signature': invalidSig },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'generic');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a generic webhook with expired timestamp', async () => {
      const payload = JSON.stringify({ event: 'test.event' });
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400);
      const signature = generateGenericSignature(
        payload,
        GENERIC_SECRET,
        oldTimestamp,
      );

      const request = {
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': oldTimestamp,
        },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, 'generic');
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Provider detection', () => {
    it('should auto-detect Stripe from headers when no decorator is used', async () => {
      const payload = JSON.stringify({ type: 'invoice.paid' });
      const signature = generateStripeSignature(payload, STRIPE_SECRET);

      const request = {
        headers: { 'stripe-signature': signature },
        rawBody: Buffer.from(payload),
      };

      // No metadata provider specified
      const context = createMockContext(request, undefined);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should auto-detect PayPal from headers when no decorator is used', async () => {
      const payload = JSON.stringify({ event_type: 'CHECKOUT.ORDER.COMPLETED' });
      const signature = generatePaypalSignature(payload, PAYPAL_SECRET);

      const request = {
        headers: { 'x-paypal-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, undefined);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should default to generic when no specific headers are found', async () => {
      const payload = JSON.stringify({ event: 'callback.received' });
      const signature = generateGenericSignature(payload, GENERIC_SECRET);

      const request = {
        headers: { 'x-webhook-signature': signature },
        rawBody: Buffer.from(payload),
      };

      const context = createMockContext(request, undefined);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Raw body handling', () => {
    it('should handle rawBody as string', async () => {
      const payload = '{"type":"test"}';
      const signature = generateGenericSignature(payload, GENERIC_SECRET);

      const request = {
        headers: { 'x-webhook-signature': signature },
        rawBody: payload, // string, not buffer
      };

      const context = createMockContext(request, 'generic');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should handle body as parsed object when rawBody is not available', async () => {
      const bodyObj = { type: 'test' };
      const payload = JSON.stringify(bodyObj);
      const signature = generateGenericSignature(payload, GENERIC_SECRET);

      const request = {
        headers: { 'x-webhook-signature': signature },
        body: bodyObj, // parsed object, no rawBody
      };

      const context = createMockContext(request, 'generic');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
