/**
 * Redis Module
 *
 * Provides Redis client, key namespace management, TTL constants,
 * and a high-level cache manager for the gaming platform.
 */

export { RedisClient, RedisConfig, defaultRedisConfig } from './redis-client.js';
export {
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
} from './redis-namespaces.js';
export { TTL, TTLKey, getTTL } from './redis-ttl.js';
export { CacheManager } from './redis-cache.js';
