/**
 * IAffiliateService Interface
 *
 * Contract for affiliate program management: registration, link tracking,
 * commission calculation, and payout processing.
 */

import { AffiliateId, UserId, GameId, TrackingCode } from '../branded-types.js';
import { DateRange } from '../utility-types.js';
import {
  Affiliate,
  AffiliateEarnings,
  Commission,
  TrackingLink,
  ConversionEvent,
  PayoutRequest,
  PayoutResult,
} from '../models/affiliate.js';

// ============================================================================
// Affiliate Service Interface
// ============================================================================

export interface IAffiliateService {
  /**
   * Apply to become an affiliate.
   * Creates application and routes through approval workflow.
   */
  applyAsAffiliate(userId: UserId, application: AffiliateApplication): Promise<Affiliate>;

  /**
   * Get affiliate details by ID.
   */
  getAffiliate(affiliateId: AffiliateId): Promise<Affiliate>;

  /**
   * Get affiliate associated with a user.
   */
  getAffiliateByUserId(userId: UserId): Promise<Affiliate>;

  /**
   * Generate a tracking link for an affiliate.
   * Optionally targets a specific game.
   */
  generateLink(affiliateId: AffiliateId, gameId?: GameId): Promise<TrackingLink>;

  /**
   * Record a click event on a tracking link.
   */
  trackClick(trackingCode: TrackingCode, clickContext: ClickContext): Promise<void>;

  /**
   * Track a conversion event when a referred user completes a qualifying action.
   * Calculates commission based on affiliate tier and fraud score.
   */
  trackConversion(event: ConversionEvent): Promise<Commission>;

  /**
   * Get earnings summary for an affiliate within a date range.
   */
  getEarnings(affiliateId: AffiliateId, dateRange: DateRange): Promise<AffiliateEarnings>;

  /**
   * Request a payout for accumulated earnings.
   * Enforces minimum $50 payout threshold.
   */
  requestPayout(request: PayoutRequest): Promise<PayoutResult>;

  /**
   * Approve an affiliate application (admin action).
   */
  approveAffiliate(affiliateId: AffiliateId): Promise<Affiliate>;

  /**
   * Reject an affiliate application (admin action).
   */
  rejectAffiliate(affiliateId: AffiliateId, reason: string): Promise<void>;

  /**
   * Suspend an affiliate for suspected fraud.
   */
  suspendAffiliate(affiliateId: AffiliateId, reason: string): Promise<void>;

  /**
   * Ban a confirmed fraudulent affiliate and reverse pending earnings.
   */
  banAffiliate(affiliateId: AffiliateId): Promise<void>;

  /**
   * Restore a falsely flagged affiliate and credit withheld commissions.
   */
  restoreAffiliate(affiliateId: AffiliateId): Promise<Affiliate>;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface AffiliateApplication {
  website?: string;
  socialMedia?: string[];
  audience?: string;
  promotionStrategy?: string;
}

export interface ClickContext {
  ipAddress: string;
  userAgent: string;
  referrer?: string;
  timestamp: Date;
  geoLocation?: GeoLocation;
}

export interface GeoLocation {
  country: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}
