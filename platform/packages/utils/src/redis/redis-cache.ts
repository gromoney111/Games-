import { Redis } from 'ioredis';

/**
 * CacheManager provides a high-level caching interface on top of Redis.
 * Handles serialization/deserialization, TTL management, and common
 * cache patterns like get-or-set.
 */
export class CacheManager {
  constructor(private redis: Redis) {}

  /**
   * Get a cached value by key.
   * Returns null if the key does not exist or has expired.
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in the cache with a TTL (in seconds).
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.setex(key, ttl, serialized);
  }

  /**
   * Delete a cached value by key.
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Check if a key exists in the cache.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Increment a counter key. Optionally set a TTL if the key is new.
   * Useful for rate limiting and frequency capping.
   * Returns the new counter value.
   */
  async increment(key: string, ttl?: number): Promise<number> {
    const value = await this.redis.incr(key);
    if (ttl !== undefined && value === 1) {
      await this.redis.expire(key, ttl);
    }
    return value;
  }

  /**
   * Get a cached value, or compute and store it if not present.
   * Implements the cache-aside pattern.
   *
   * @param key - The cache key
   * @param factory - Async function to produce the value on cache miss
   * @param ttl - TTL in seconds for the cached value
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Get the remaining TTL for a key (in seconds).
   * Returns -1 if the key has no expiry, -2 if the key doesn't exist.
   */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }
}
