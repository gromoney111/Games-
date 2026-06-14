/**
 * IAdService Interface
 *
 * Contract for ad placement, impression tracking, click tracking,
 * revenue reporting, and GDPR-compliant ad personalization.
 */

import { AdId } from '../branded-types.js';
import { DateRange } from '../utility-types.js';
import {
  AdUnit,
  AdContext,
  ImpressionContext,
  AdRevenueReport,
} from '../models/ad.js';

// ============================================================================
// Ad Service Interface
// ============================================================================

export interface IAdService {
  /**
   * Get an appropriate ad unit based on page context and placement configuration.
   * Respects frequency capping and user consent.
   */
  getAdPlacement(context: AdContext): Promise<AdUnit | null>;

  /**
   * Record an ad impression.
   * If user has consent, stores personalized impression; otherwise anonymous.
   */
  trackImpression(adId: AdId, context: ImpressionContext): Promise<void>;

  /**
   * Record an ad click event with full context.
   */
  trackClick(adId: AdId, context: ImpressionContext): Promise<void>;

  /**
   * Get ad revenue report for a date range.
   * Aggregates impressions, clicks, and revenue by placement and format.
   */
  getAdRevenue(dateRange: DateRange): Promise<AdRevenueReport>;

  /**
   * Configure a new ad unit or update an existing one.
   */
  configureAd(adUnit: Partial<AdUnit> & { placement: AdUnit['placement'] }): Promise<AdUnit>;

  /**
   * Check if frequency cap has been reached for a specific user and ad.
   */
  isFrequencyCapReached(adId: AdId, userId: string): Promise<boolean>;

  /**
   * Reset frequency cap counters (e.g., for testing or manual override).
   */
  resetFrequencyCap(adId: AdId, userId: string): Promise<void>;
}
