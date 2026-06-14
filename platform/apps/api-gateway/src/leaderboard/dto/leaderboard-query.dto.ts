/**
 * Leaderboard Query DTO
 *
 * Validates query parameters for the leaderboard endpoint:
 * - period: time filter (daily, weekly, monthly, all-time). Default: all-time
 * - limit: max entries to return (1–1000). Default: 50
 *
 * Requirements: 6.1, 6.3
 */

import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class LeaderboardQueryDto {
  /**
   * Time period filter for leaderboard scores.
   * - daily: scores from today (midnight UTC)
   * - weekly: scores from the last 7 days
   * - monthly: scores from the last 30 days
   * - all-time: no time restriction (default)
   */
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'all-time'])
  period?: string = 'all-time';

  /**
   * Maximum number of leaderboard entries to return.
   * Must be between 1 and 1000 inclusive. Default: 50.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;
}
