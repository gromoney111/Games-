/**
 * Utils Package
 *
 * Shared utility functions used across all apps and services
 * in the gaming platform.
 */

// ============================================================================
// Queue Infrastructure
// ============================================================================

export * from './queue/index.js';

// ============================================================================
// Redis Module
// ============================================================================

export {
  RedisClient,
  RedisConfig,
  defaultRedisConfig,
  RedisNamespaces,
  RedisNamespace,
  buildKey,
  sessionKey,
  rateLimitKey,
  profileCacheKey,
  leaderboardCacheKey,
  adFrequencyKey,
  failedAttemptsKey,
  refreshTokenKey,
  TTL,
  TTLKey,
  getTTL,
  CacheManager,
} from './redis/index.js';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID string.
 * Uses crypto.randomUUID for secure, collision-resistant IDs.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate email format according to RFC 5322 (simplified).
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username: 3-30 alphanumeric characters.
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate that a string is a URL-safe slug.
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Truncate a string with ellipsis if it exceeds maxLength.
 */
export function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Date/Time Utilities
// ============================================================================

/**
 * Get the current timestamp as an ISO string.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Check if a date is within a rolling window (in hours).
 */
export function isWithinRollingWindow(date: Date, windowHours: number): boolean {
  const windowMs = windowHours * 60 * 60 * 1000;
  return Date.now() - date.getTime() < windowMs;
}

// ============================================================================
// Currency Utilities
// ============================================================================

/**
 * Validate ISO 4217 currency code.
 */
export function isValidCurrencyCode(code: string): boolean {
  const validCodes = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'INR'];
  return validCodes.includes(code.toUpperCase());
}
