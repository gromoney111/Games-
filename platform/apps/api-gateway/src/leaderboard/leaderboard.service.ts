/**
 * Leaderboard Service
 *
 * Business logic for game leaderboard retrieval:
 * - Fetches top scores from database or Redis cache
 * - Sorts descending by score, breaks ties by earliest timestamp
 * - Assigns unique sequential ranks 1..N
 * - Caches results in Redis with 30-second TTL
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 19.5
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { LeaderboardRepository, LeaderboardWhereInput } from './leaderboard.repository';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { REDIS_CLIENT } from '../common/guards/rate-limit.guard';

/** Shape of a single leaderboard entry returned to clients */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  achievedAt: Date;
}

/** Shape of the full leaderboard response */
export interface LeaderboardResponse {
  gameId: string;
  period: string;
  entries: LeaderboardEntry[];
  total: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly leaderboardRepository: LeaderboardRepository,
    @Inject(REDIS_CLIENT) private readonly cache: any,
  ) {}

  /**
   * Retrieve the leaderboard for a game within the specified time period.
   * Uses Redis caching with a 30-second TTL (Requirement 19.5).
   *
   * Requirement 6.1: ranked list sorted descending by score
   * Requirement 6.2: tie-breaking by earliest achievement timestamp
   * Requirement 6.3: limit between 1 and 1000
   * Requirement 6.4: unique sequential ranks 1..N
   */
  async getLeaderboard(
    gameId: string,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    const { period = 'all-time', limit = 50 } = query;

    // Try Redis cache first (30-second TTL per Requirement 19.5)
    const cacheKey = `cache:leaderboard:${gameId}:${period}:${limit}`;
    try {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis cache read error: ${(err as Error).message}`);
    }

    // Compute date filter based on period
    const dateFilter = this.getDateFilter(period);

    // Build query filter
    const where: LeaderboardWhereInput = { gameId };
    if (dateFilter) {
      where.completedAt = { gte: dateFilter };
    }

    // Query game results sorted by score DESC, completedAt ASC (tie-breaking)
    const results = await this.leaderboardRepository.getTopScores(where, limit);

    // Assign sequential ranks 1..N (Requirement 6.4)
    const entries: LeaderboardEntry[] = results.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.user.username,
      displayName: entry.user.profile?.displayName || entry.user.username,
      avatarUrl: entry.user.profile?.avatarUrl || null,
      score: entry.score,
      achievedAt: entry.completedAt,
    }));

    const response: LeaderboardResponse = {
      gameId,
      period,
      entries,
      total: entries.length,
    };

    // Cache for 30 seconds
    try {
      await this.cache.setex(cacheKey, 30, JSON.stringify(response));
    } catch (err) {
      this.logger.warn(`Redis cache write error: ${(err as Error).message}`);
    }

    return response;
  }

  /**
   * Compute the date boundary for the given period.
   * Returns null for 'all-time' (no date restriction).
   */
  getDateFilter(period: string): Date | null {
    const now = new Date();
    switch (period) {
      case 'daily': {
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        return start;
      }
      case 'weekly': {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return start;
      }
      case 'monthly': {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        return start;
      }
      case 'all-time':
      default:
        return null;
    }
  }
}
