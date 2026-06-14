/**
 * Sessions Repository
 *
 * Database access layer for game sessions and game results via Prisma ORM.
 * Handles CRUD for game_sessions and game_results tables.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSessionData {
  id: string;
  userId: string;
  gameId: string;
  state: any;
}

export interface EndSessionData {
  score: number;
  endedAt: Date;
  duration: number;
  state: any;
  actions: any[];
}

export interface CreateGameResultData {
  userId: string;
  gameId: string;
  sessionId: string;
  score: number;
  duration: number;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new game session record in the database.
   */
  async create(data: CreateSessionData) {
    return this.prisma.gameSession.create({
      data: {
        id: data.id,
        userId: data.userId,
        gameId: data.gameId,
        state: data.state,
        score: 0,
        startedAt: new Date(),
      },
    });
  }

  /**
   * Find a game session by ID.
   */
  async findById(sessionId: string) {
    return this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
  }

  /**
   * Count active (non-ended) sessions for a user.
   */
  async countActiveSessions(userId: string): Promise<number> {
    return this.prisma.gameSession.count({
      where: {
        userId,
        endedAt: null,
      },
    });
  }

  /**
   * End a game session by updating its record with final data.
   */
  async endSession(sessionId: string, data: EndSessionData) {
    return this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        score: data.score,
        endedAt: data.endedAt,
        duration: data.duration,
        state: data.state,
        actions: data.actions,
      },
    });
  }

  /**
   * Create a game result record (persists final score for leaderboards).
   */
  async createGameResult(data: CreateGameResultData) {
    return this.prisma.gameResult.create({
      data: {
        userId: data.userId,
        gameId: data.gameId,
        sessionId: data.sessionId,
        score: data.score,
        duration: data.duration,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Find expired sessions (inactive beyond timeout) that haven't been ended.
   * Used by the background timeout job.
   */
  async findExpiredSessions(timeoutMs: number) {
    const cutoff = new Date(Date.now() - timeoutMs);
    return this.prisma.gameSession.findMany({
      where: {
        endedAt: null,
        lastActivityAt: { lt: cutoff },
      },
    });
  }

  /**
   * Update last activity timestamp for a session.
   */
  async updateLastActivity(sessionId: string) {
    return this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }
}
