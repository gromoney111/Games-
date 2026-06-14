/**
 * Ad Data Models
 *
 * Types for ad placement, impressions, clicks, and revenue tracking.
 */

import { AdId, UserId, Url } from '../branded-types.js';
import { DateRange } from '../utility-types.js';
import { Money } from './transaction.js';

// ============================================================================
// Ad Unit
// ============================================================================

export interface AdUnit {
  id: AdId;
  placement: AdPlacement;
  size: AdSize;
  format: AdFormat;
  content: AdContent;
  targeting?: AdTargeting;
  frequencyCap: FrequencyCap;
  isActive: boolean;
}

export type AdPlacement =
  | 'header_banner'
  | 'sidebar'
  | 'in_game'
  | 'between_levels'
  | 'game_over'
  | 'footer'
  | 'interstitial';

export interface AdSize {
  width: number;
  height: number;
  label: string;
}

export type AdFormat = 'banner' | 'interstitial' | 'rewarded' | 'native';

export interface AdContent {
  adSlotId: string;
  adUnitPath: string;
  customParameters?: Record<string, string>;
}

export interface AdTargeting {
  categories?: string[];
  keywords?: string[];
  ageRange?: { min: number; max: number };
  geoTargets?: string[];
}

export interface FrequencyCap {
  maxImpressions: number;
  timeWindowSeconds: number;
}

// ============================================================================
// Ad Context
// ============================================================================

export interface AdContext {
  pageUrl: Url;
  placement: AdPlacement;
  gameId?: string;
  userId?: UserId;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  hasConsent: boolean;
}

// ============================================================================
// Ad Impressions
// ============================================================================

export interface AdImpression {
  id: string;
  adId: AdId;
  userId: UserId;
  pageUrl: Url;
  placement: AdPlacement;
  timestamp: Date;
  deviceInfo: DeviceInfo;
}

export interface AnonymousImpression {
  id: string;
  adId: AdId;
  pageUrl: Url;
  placement: AdPlacement;
  timestamp: Date;
}

export interface ImpressionContext {
  userId?: UserId;
  pageUrl: Url;
  placement: AdPlacement;
  deviceInfo: DeviceInfo;
  hasConsent: boolean;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenSize?: string;
}

// ============================================================================
// Ad Revenue
// ============================================================================

export interface AdRevenueReport {
  dateRange: DateRange;
  totalImpressions: number;
  totalClicks: number;
  clickThroughRate: number;
  totalRevenue: Money;
  revenueByPlacement: Record<AdPlacement, Money>;
  revenueByFormat: Record<AdFormat, Money>;
  topPerformingPages: AdPagePerformance[];
}

export interface AdPagePerformance {
  pageUrl: string;
  impressions: number;
  clicks: number;
  revenue: Money;
  ctr: number;
}
