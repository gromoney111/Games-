/**
 * Analytics Repository
 *
 * Database access layer for analytics event storage and metric queries.
 * Provides methods for event ingestion and aggregated reporting.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateEventInput {
  userId?: string;
  eventType: string;
  payload?: Record<string, any>;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new analytics event record.
   */
  async create(input: CreateEventInput) {
    return this.prisma.analyticsEvent.create({
      data: {
        userId: input.userId || null,
        eventType: input.eventType,
        payload: input.payload || {},
      },
    });
  }

  /**
   * Count total sessions (game_start events) within a date range.
   */
  async countSessions(startDate: string, endDate: string): Promise<number> {
    return this.prisma.analyticsEvent.count({
      where: {
        eventType: 'game_start',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
    });
  }

  /**
   * Sum total play time (in seconds) from game_end events within a date range.
   * Reads duration from the payload.duration field.
   */
  async sumPlayTime(startDate: string, endDate: string): Promise<number> {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: 'game_end',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { payload: true },
    });

    return events.reduce((total: number, event: any) => {
      const duration = event.payload?.duration || 0;
      return total + Number(duration);
    }, 0);
  }

  /**
   * Get count of distinct active users per day within the date range.
   */
  async getDailyActiveUsers(startDate: string, endDate: string): Promise<number> {
    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
    });

    return result.length;
  }

  /**
   * Get retention rates (day 1, day 7, day 30).
   * Returns percentage of users who returned after their first session.
   */
  async getRetentionRates(
    startDate: string,
    endDate: string,
  ): Promise<{ day1: number; day7: number; day30: number }> {
    // Simplified: count users active on day 1, 7, 30 relative to start
    const start = new Date(startDate);

    const totalUsers = await this.prisma.analyticsEvent.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: {
          gte: start,
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
    });

    if (totalUsers.length === 0) {
      return { day1: 0, day7: 0, day30: 0 };
    }

    const day1Date = new Date(start);
    day1Date.setDate(day1Date.getDate() + 1);
    const day1End = new Date(day1Date);
    day1End.setDate(day1End.getDate() + 1);

    const day7Date = new Date(start);
    day7Date.setDate(day7Date.getDate() + 7);
    const day7End = new Date(day7Date);
    day7End.setDate(day7End.getDate() + 1);

    const day30Date = new Date(start);
    day30Date.setDate(day30Date.getDate() + 30);
    const day30End = new Date(day30Date);
    day30End.setDate(day30End.getDate() + 1);

    const [day1Users, day7Users, day30Users] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          createdAt: { gte: day1Date, lt: day1End },
        },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          createdAt: { gte: day7Date, lt: day7End },
        },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          createdAt: { gte: day30Date, lt: day30End },
        },
      }),
    ]);

    const total = totalUsers.length;
    return {
      day1: Math.round((day1Users.length / total) * 100),
      day7: Math.round((day7Users.length / total) * 100),
      day30: Math.round((day30Users.length / total) * 100),
    };
  }

  /**
   * Get game performance metrics within a date range.
   */
  async getGamePerformance(
    startDate: string,
    endDate: string,
  ): Promise<
    Array<{
      gameId: string;
      title: string;
      playCount: number;
      avgDuration: number;
      completionRate: number;
      revenue: number;
    }>
  > {
    const gameStarts = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: { in: ['game_start', 'game_end'] },
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { eventType: true, payload: true },
    });

    // Aggregate by game
    const gameMap = new Map<
      string,
      { starts: number; ends: number; totalDuration: number; revenue: number; title: string }
    >();

    for (const event of gameStarts) {
      const payload = event.payload as any;
      const gameId = payload?.gameId || 'unknown';
      const title = payload?.gameTitle || gameId;

      if (!gameMap.has(gameId)) {
        gameMap.set(gameId, { starts: 0, ends: 0, totalDuration: 0, revenue: 0, title });
      }
      const entry = gameMap.get(gameId)!;

      if (event.eventType === 'game_start') {
        entry.starts++;
      } else if (event.eventType === 'game_end') {
        entry.ends++;
        entry.totalDuration += Number(payload?.duration || 0);
      }
    }

    // Add revenue from purchase events
    const purchases = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: 'purchase',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { payload: true },
    });

    for (const purchase of purchases) {
      const payload = purchase.payload as any;
      const gameId = payload?.gameId;
      if (gameId && gameMap.has(gameId)) {
        gameMap.get(gameId)!.revenue += Number(payload?.amount || 0);
      }
    }

    return Array.from(gameMap.entries()).map(([gameId, data]) => ({
      gameId,
      title: data.title,
      playCount: data.starts,
      avgDuration: data.ends > 0 ? Math.round(data.totalDuration / data.ends) : 0,
      completionRate: data.starts > 0 ? Math.round((data.ends / data.starts) * 100) : 0,
      revenue: data.revenue,
    }));
  }

  /**
   * Get gross revenue from purchase events within a date range.
   */
  async getGrossRevenue(startDate: string, endDate: string): Promise<number> {
    const purchases = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: 'purchase',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { payload: true },
    });

    return purchases.reduce((total: number, event: any) => {
      return total + Number(event.payload?.amount || 0);
    }, 0);
  }

  /**
   * Get total refund amount within a date range.
   * Refunds are recorded as purchase events with payload.refund = true.
   */
  async getRefunds(startDate: string, endDate: string): Promise<number> {
    const refunds = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: 'purchase',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { payload: true },
    });

    return refunds.reduce((total: number, event: any) => {
      if (event.payload?.refund) {
        return total + Number(event.payload?.amount || 0);
      }
      return total;
    }, 0);
  }

  /**
   * Get ad revenue from ad_impression and ad_click events within a date range.
   */
  async getAdRevenue(startDate: string, endDate: string): Promise<number> {
    const adEvents = await this.prisma.analyticsEvent.findMany({
      where: {
        eventType: { in: ['ad_impression', 'ad_click'] },
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      select: { payload: true },
    });

    return adEvents.reduce((total: number, event: any) => {
      return total + Number(event.payload?.revenue || 0);
    }, 0);
  }
}
