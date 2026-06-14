import { SetMetadata } from '@nestjs/common';

/**
 * Supported webhook provider types.
 * - 'stripe': Stripe payment webhook with signature format t=timestamp,v1=hash
 * - 'paypal': PayPal webhook with SHA256 signature verification
 * - 'generic': Generic HMAC-SHA256 webhook signature verification
 */
export type WebhookProviderType = 'stripe' | 'paypal' | 'generic';

export const WEBHOOK_PROVIDER_KEY = 'webhook_provider';

/**
 * Decorator to mark an endpoint as a webhook receiver.
 * Used with WebhookSignatureGuard to validate incoming webhook signatures.
 *
 * @param provider - The webhook provider type ('stripe', 'paypal', or 'generic')
 *
 * @example
 * @WebhookProvider('stripe')
 * @Post('webhooks/stripe')
 * handleStripeWebhook(@Body() payload: any) { ... }
 *
 * @example
 * @WebhookProvider('generic')
 * @Post('webhooks/callback')
 * handleCallback(@Body() payload: any) { ... }
 */
export const WebhookProvider = (provider: WebhookProviderType) =>
  SetMetadata(WEBHOOK_PROVIDER_KEY, provider);
