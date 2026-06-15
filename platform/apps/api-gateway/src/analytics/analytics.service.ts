/**
 * Analytics Service
 *
 * Business logic for event tracking and metrics reporting.
 * Handles event ingestion, date range validation, and metric aggregation.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { TrackEventDto, VALID_EVENT_TYPES } from './dto/track-event.dto';
import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepo: AnalyticsRepository) {}

  /**
   * Track an analytics event.
   * Validates event type against allowed types before recording.
   *
   * Requirement 15.1: Record events with full context within 5 seconds.
   */
  async trackEvent(event: TrackEventDto) {
    if (!VALID_EVENT_TYPES.includes(event.eventType as any)) {
      throw new BadRequestException('Invalid event type');
    }

    await this.analyticsRepo.create({
      userId: event.userId,
      eventType: event.eventType,
      payload: event.payload,
    });

    return { tracked: true };
  }

  /**
   * Get user engagement metrics for a date range.
   * Returns session counts, play time, daily active users, and retention rates.
   *
   * Requirement 15.2: Aggregated user engagement data.
   */
  async getUserMetrics(query: DateRangeDto) {
    this.validateDateRange(query);

    const { startDate, endDate } = query;

    const [sessionCount, totalPlayTime, dailyActiveUsers, retention] =
      await Promise.all([
        this.analyticsRepo.countSessions(startDate, endDate),
        this.analyticsRepo.sumPlayTime(startDate, endDate),
        this.analyticsRepo.getDailyActiveUsers(startDate, endDate),
        this.analyticsRepo.getRetentionRates(startDate, endDate),
      ]);

    return {
      period: { startDate, endDate },
      totalSessions: sessionCount,
      totalPlayTimeMinutes: Math.round(totalPlayTime / 60),
      dailyActiveUsers,
      retention: {
        day1: retention.day1,
        day7: retention.day7,
        day30: retention.day30,
      },
    };
  }

  /**
   * Get game performance metrics for a date range.
   * Returns play counts, avg session duration, completion rate, and revenue per game.
   *
   * Requirement 15.3: Game performance data.
   */
  async getGameMetrics(query: DateRangeDto) {
    this.validateDateRange(query);

    const games = await this.analyticsRepo.getGamePerformance(
      query.startDate,
      query.endDate,
    );

    return {
      period: { startDate: query.startDate, endDate: query.endDate },
      games: games.map((g) => ({
        gameId: g.gameId,
        title: g.title,
        totalPlays: g.playCount,
        avgSessionDuration: g.avgDuration,
        completionRate: g.completionRate,
        revenue: g.revenue,
      })),
    };
  }

  /**
   * Get revenue metrics for a date range.
   * Returns gross revenue, refunds, net revenue, ad revenue, and revenue by source.
   * Net revenue = gross - refunds (consistency property).
   *
   * Requirement 15.4: Financial data including gross, refunds, net, and by source.
   */
  async getRevenueMetrics(query: DateRangeDto) {
    this.validateDateRange(query);

    const { startDate, endDate } = query;
    const [gross, refunds, adRevenue] = await Promise.all([
      this.analyticsRepo.getGrossRevenue(startDate, endDate),
      this.analyticsRepo.getRefunds(startDate, endDate),
      this.analyticsRepo.getAdRevenue(startDate, endDate),
    ]);

    const netRevenue = gross - refunds;

    return {
      period: { startDate, endDate },
      grossRevenue: gross,
      refunds,
      netRevenue,
      adRevenue,
      totalRevenue: netRevenue + adRevenue,
      bySource: {
        inAppPurchases: gross - refunds,
        advertising: adRevenue,
        subscriptions: 0, // Future feature
      },
    };
  }

  /**
   * Validate date range parameters.
   * Ensures: start < end, range <= 365 days, start not in future.
   */
  validateDateRange(query: DateRangeDto) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start date');
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException('Invalid end date');
    }

    const diffDays =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    if (start > end) {
      throw new BadRequestException('Start date must be before end date');
    }
    if (diffDays > 365) {
      throw new BadRequestException('Date range cannot exceed 365 days');
    }
    if (start > new Date()) {
      throw new BadRequestException('Start date cannot be in the future');
    }
  }
}
