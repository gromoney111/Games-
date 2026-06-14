/**
 * TTL (Time-To-Live) constants in seconds for Redis keys.
 * These values match the design specification requirements.
 *
 * Requirements:
 * - 19.4: Cache game session state with TTL matching session duration
 * - 19.5: Cache user profiles (5-min TTL) and leaderboards (30-sec TTL)
 */
export const TTL = {
  /** Session default expiry: 1 hour */
  SESSION_DEFAULT: 3600,

  /** User profile cache: 5 minutes (Requirement 19.5) */
  PROFILE_CACHE: 300,

  /** Leaderboard cache: 30 seconds (Requirement 19.5) */
  LEADERBOARD_CACHE: 30,

  /** Rate limit sliding window: 1 minute */
  RATE_LIMIT_WINDOW: 60,

  /** Ad frequency cap window: 24 hours */
  AD_FREQUENCY_WINDOW: 86400,

  /** Failed login attempts tracking: 15 minutes */
  FAILED_ATTEMPTS: 900,

  /** Refresh token expiry: 7 days */
  REFRESH_TOKEN: 604800,

  /** Access token expiry: 15 minutes */
  ACCESS_TOKEN: 900,
} as const;

export type TTLKey = keyof typeof TTL;

/**
 * Get TTL value by key name.
 */
export function getTTL(key: TTLKey): number {
  return TTL[key];
}
