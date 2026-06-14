/**
 * IAnalyticsService Interface
 *
 * Contract for event tracking, metrics aggregation, reporting,
 * and data retention management.
 */

import { UserId, GameId } from '../branded-types.js';
import { DateRange } from '../utility-types.js';
import {
  AnalyticsEvent,
  PageViewEvent,
  UserMetrics,
  GameMetrics,
  RevenueMetrics,
  SEOMetrics,
  Report,
  ReportParams,
} from '../models/analytics.js';

// ============================================================================
// Analytics Service Interface
// ============================================================================

export interface IAnalyticsService {
  /**
   * Track a platform event (game start, game end, purchase, etc.).
   * Events are processed asynchronously via message queue.
   */
  trackEvent(event: AnalyticsEvent): Promise<void>;

  /**
   * Track a page view event for SEO and engagement analytics.
   */
  trackPageView(event: PageViewEvent): Promise<void>;

  /**
   * Get aggregated user engagement metrics for a date range.
   * Includes session counts, play time, retention metrics.
   */
  getUserMetrics(dateRange: DateRange): Promise<UserMetrics>;

  /**
   * Get user-specific metrics.
   */
  getUserMetricsById(userId: UserId, dateRange: DateRange): Promise<UserMetrics>;

  /**
   * Get game performance metrics for a date range.
   * Includes play counts, average session duration, revenue per game.
   */
  getGameMetrics(gameId: GameId, dateRange: DateRange): Promise<GameMetrics>;

  /**
   * Get financial metrics for a date range.
   * Includes gross revenue, refunds, net revenue, revenue by source.
   */
  getRevenueMetrics(dateRange: DateRange): Promise<RevenueMetrics>;

  /**
   * Get SEO metrics including organic traffic, impressions, CTR.
   */
  getSEOMetrics(dateRange: DateRange): Promise<SEOMetrics>;

  /**
   * Generate a report of the specified type and parameters.
   */
  generateReport(params: ReportParams): Promise<Report>;

  /**
   * Purge raw event data beyond the configured retention period.
   * Preserves aggregated summaries.
   */
  enforceRetentionPolicy(): Promise<void>;
}
