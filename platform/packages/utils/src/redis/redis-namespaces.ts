/**
 * Redis key namespace constants.
 * All keys are prefixed with their namespace to avoid collisions.
 */
export const RedisNamespaces = {
  SESSION: 'session',
  RATE_LIMIT: 'rate_limit',
  CACHE: 'cache',
  AD_FREQ: 'ad_freq',
  FAILED_ATTEMPTS: 'failed_attempts',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export type RedisNamespace = (typeof RedisNamespaces)[keyof typeof RedisNamespaces];

/**
 * Build a namespaced Redis key from parts.
 * @example buildKey('session', 'abc123') => 'session:abc123'
 * @example buildKey('cache', 'profile', 'user1') => 'cache:profile:user1'
 */
export const buildKey = (namespace: string, ...parts: string[]): string =>
  `${namespace}:${parts.join(':')}`;

// ============================================================================
// Specific Key Builders
// ============================================================================

/**
 * Build a session key for storing game session state.
 */
export const sessionKey = (sessionId: string): string =>
  buildKey(RedisNamespaces.SESSION, sessionId);

/**
 * Build a rate limit key for tracking request counts per user.
 */
export const rateLimitKey = (userId: string): string =>
  buildKey(RedisNamespaces.RATE_LIMIT, userId);

/**
 * Build a profile cache key for user profile data.
 */
export const profileCacheKey = (userId: string): string =>
  buildKey(RedisNamespaces.CACHE, 'profile', userId);

/**
 * Build a leaderboard cache key for game leaderboard data.
 */
export const leaderboardCacheKey = (gameId: string, period: string): string =>
  buildKey(RedisNamespaces.CACHE, 'leaderboard', gameId, period);

/**
 * Build an ad frequency cap key for tracking ad impressions per user.
 */
export const adFrequencyKey = (userId: string, adId: string): string =>
  buildKey(RedisNamespaces.AD_FREQ, userId, adId);

/**
 * Build a failed attempts key for tracking login failures.
 */
export const failedAttemptsKey = (userId: string): string =>
  buildKey(RedisNamespaces.FAILED_ATTEMPTS, userId);

/**
 * Build a refresh token key for storing user refresh tokens.
 */
export const refreshTokenKey = (userId: string): string =>
  buildKey(RedisNamespaces.REFRESH_TOKEN, userId);
