/**
 * Redis Service
 *
 * Provides Redis-backed functionality for authentication:
 * - Failed login attempt tracking (INCR with 15-min TTL)
 * - Account lockout (30-min TTL)
 * - Refresh token storage (7-day TTL)
 *
 * Uses in-memory Map as fallback when Redis is not available (development mode).
 */

import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  // In-memory store (fallback for development / when Redis is not connected)
  private store = new Map<string, CacheEntry>();

  // Key prefixes
  private readonly FAILED_ATTEMPTS_PREFIX = 'auth:failed_attempts:';
  private readonly ACCOUNT_LOCK_PREFIX = 'auth:account_lock:';
  private readonly REFRESH_TOKEN_PREFIX = 'auth:refresh_token:';

  // TTL values in seconds
  private readonly FAILED_ATTEMPTS_TTL = 15 * 60; // 15 minutes
  private readonly ACCOUNT_LOCK_TTL = 30 * 60; // 30 minutes
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

  /**
   * Get the number of failed login attempts for a user.
   * Returns 0 if no record exists or if TTL has expired.
   */
  async getFailedAttempts(userId: string): Promise<number> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${userId}`;
    const entry = this.get(key);
    if (!entry) {
      return 0;
    }
    return parseInt(entry, 10) || 0;
  }

  /**
   * Increment failed login attempts for a user.
   * Sets a 15-minute TTL on the key (resets the window on each failure).
   * Returns the new count.
   */
  async incrementFailedAttempts(userId: string): Promise<number> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${userId}`;
    const current = await this.getFailedAttempts(userId);
    const newCount = current + 1;
    this.set(key, newCount.toString(), this.FAILED_ATTEMPTS_TTL);
    return newCount;
  }

  /**
   * Reset failed login attempts for a user (on successful login).
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${userId}`;
    this.del(key);
  }

  /**
   * Lock an account for 30 minutes.
   */
  async lockAccount(userId: string): Promise<void> {
    const key = `${this.ACCOUNT_LOCK_PREFIX}${userId}`;
    this.set(key, 'locked', this.ACCOUNT_LOCK_TTL);
    this.logger.warn(`Account locked for user ${userId} (30-min lockout)`);
  }

  /**
   * Check if an account is currently locked.
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    const key = `${this.ACCOUNT_LOCK_PREFIX}${userId}`;
    const entry = this.get(key);
    return entry === 'locked';
  }

  /**
   * Store a refresh token in Redis with 7-day TTL.
   * Uses userId as key prefix to allow per-user token lookup/revocation.
   */
  async storeRefreshToken(userId: string, tokenId: string, token: string): Promise<void> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    this.set(key, token, this.REFRESH_TOKEN_TTL);
  }

  /**
   * Get a stored refresh token.
   */
  async getRefreshToken(userId: string, tokenId: string): Promise<string | null> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    return this.get(key);
  }

  /**
   * Revoke (delete) a specific refresh token.
   */
  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    this.del(key);
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices).
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const prefix = `${this.REFRESH_TOKEN_PREFIX}${userId}:`;
    const keysToDelete: string[] = [];
    this.store.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.store.delete(key));
  }

  // ---- Internal cache operations (in-memory fallback) ----

  private get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  private set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private del(key: string): void {
    this.store.delete(key);
  }
}
