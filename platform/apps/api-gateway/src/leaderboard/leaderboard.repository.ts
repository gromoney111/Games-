/**
 * Leaderboard Repository
 *
 * Database access layer for leaderboard queries via Prisma ORM.
 * Fetches top game results sorted by score (descending) with tie-breaking
 * by earliest achievement timestamp (ascending).
 *
 * Requirements: 6.1, 6.2, 6.4
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LeaderboardWhereInput {
  gameId: string;
  completedAt?: { gte: Date };
}

export interface LeaderboardRawEntry {
  userId: string;
  score: number;
  completedAt: Date;
  user: {
    username: string;
    profile?: {
      displayName?: string | null;
      avatarUrl?: string | null;
    } | null;
  };
}

@Injectable()
export class LeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch top scores for a game within an optional date range.
   * Sorted: score DESC, completedAt ASC (earliest timestamp breaks ties).
   * Limited to the specified number of entries.
   *
   * Requirement 6.1: ranked list sorted descending by score
   * Requirement 6.2: tie-breaking by earliest achievement timestamp
   */
  async getTopScores(
    where: LeaderboardWhereInput,
    limit: number,
  ): Promise<LeaderboardRawEntry[]> {
    return this.prisma.gameResult.findMany({
      where: {
        gameId: where.gameId,
        ...(where.completedAt ? { completedAt: where.completedAt } : {}),
      },
      orderBy: [
        { score: 'desc' },
        { completedAt: 'asc' },
      ],
      take: limit,
      include: {
        user: {
          select: {
            username: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }
}
