/**
 * Analytics Data Models
 *
 * Types for event tracking, metrics, reports, and SEO analytics.
 */

import { UserId, GameId, Url, ReportId } from '../branded-types.js';
import { DateRange } from '../utility-types.js';
import { Money } from './transaction.js';

// ============================================================================
// Analytics Events
// ============================================================================

export interface AnalyticsEvent {
  id: string;
  eventType: 'game_start' | 'game_end' | 'purchase' | 'page_view' | 'ad_click' | 'signup' | 'login';
  userId?: UserId;
  timestamp: Date;
  sessionId?: string;
  properties: Record<string, unknown>;
  context: EventContext;
}

export interface EventContext {
  ipAddress?: string;
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  referrer?: string;
  pageUrl?: string;
}

export interface PageViewEvent {
  url: Url;
  userId?: UserId;
  title: string;
  referrer?: string;
  timestamp: Date;
  duration?: number;
  context: EventContext;
}

// ============================================================================
// Metrics
// ============================================================================

export interface UserMetrics {
  dateRange: DateRange;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  averageSessionDuration: number;
  sessionsPerUser: number;
  retentionRate: number;
  churnRate: number;
}

export interface GameMetrics {
  gameId: GameId;
  dateRange: DateRange;
  totalPlays: number;
  uniquePlayers: number;
  averageSessionDuration: number;
  averageScore: number;
  completionRate: number;
  revenueGenerated: Money;
}

export interface RevenueMetrics {
  dateRange: DateRange;
  grossRevenue: Money;
  refunds: Money;
  netRevenue: Money;
  revenueBySource: RevenueBySource;
  transactionCount: number;
  averageTransactionValue: Money;
}

export interface RevenueBySource {
  purchases: Money;
  subscriptions: Money;
  adRevenue: Money;
  affiliateCommissions: Money;
}

export interface SEOMetrics {
  dateRange: DateRange;
  organicTraffic: number;
  impressions: number;
  clicks: number;
  averageCTR: number;
  averagePosition: number;
  indexedPages: number;
  topKeywords: KeywordMetric[];
}

export interface KeywordMetric {
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

// ============================================================================
// Reports
// ============================================================================

export interface Report {
  id: ReportId;
  type: ReportType;
  title: string;
  dateRange: DateRange;
  generatedAt: Date;
  generatedBy: UserId;
  data: Record<string, unknown>;
  format: 'json' | 'csv' | 'pdf';
}

export type ReportType =
  | 'user_engagement'
  | 'game_performance'
  | 'revenue_summary'
  | 'affiliate_performance'
  | 'seo_report'
  | 'ad_revenue';

export interface ReportParams {
  type: ReportType;
  dateRange: DateRange;
  filters?: Record<string, unknown>;
  format?: 'json' | 'csv' | 'pdf';
}
