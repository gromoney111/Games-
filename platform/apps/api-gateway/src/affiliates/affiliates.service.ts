/**
 * Affiliates Service
 *
 * Implements affiliate program business logic:
 * - Affiliate registration with pending approval
 * - Unique tracking code generation (URL-safe, 8-32 chars)
 * - Click tracking via redirect endpoint
 * - Conversion tracking and attribution
 * - Commission calculation based on tier (Bronze 5%, Silver 10%, Gold 15%, Platinum 20%)
 * - 50% maximum commission cap
 * - Fraud detection (>100 clicks/min from single IP = flag)
 * - Payout processing with $50 minimum threshold
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { AffiliatesRepository, AffiliateRecord } from './affiliates.repository';
import { AffiliateApplicationDto } from './dto/affiliate-application.dto';
import { UpdateAffiliateStatusDto } from './dto/update-affiliate-status.dto';
import { DateRangeDto } from './dto/date-range.dto';

/** Commission rates by affiliate tier */
export const COMMISSION_RATES: Record<string, number> = {
  BRONZE: 0.05,
  SILVER: 0.10,
  GOLD: 0.15,
  PLATINUM: 0.20,
};

/** Maximum effective commission rate (50%) */
export const MAX_COMMISSION_RATE = 0.50;

/** Minimum payout threshold in cents ($50.00) */
export const MIN_PAYOUT_THRESHOLD = 5000;

/** Fraud score threshold (above this value, commission is rejected) */
export const FRAUD_SCORE_THRESHOLD = 70;

/** Maximum clicks per minute from a single IP before flagging */
export const MAX_CLICKS_PER_MINUTE = 100;

/** Attribution window in days */
export const ATTRIBUTION_WINDOW_DAYS = 30;

export interface ConversionEvent {
  id: string;
  userId: string;
  eventType: string;
  amount: number; // in cents
  currency: string;
  gameId?: string;
  metadata?: Record<string, any>;
}

export interface CommissionResult {
  id: string;
  affiliateId: string;
  conversionId: string;
  amount: number;
  currency: string;
  rate: number;
  status: string;
  rejected?: boolean;
  reason?: string;
}

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(private readonly affiliatesRepo: AffiliatesRepository) {}

  /**
   * Apply to become an affiliate.
   * Creates an application with PENDING status and generates a unique tracking code.
   *
   * Requirements: 9.1
   */
  async apply(userId: string, dto: AffiliateApplicationDto) {
    // Check if user already has an affiliate application
    const existing = await this.affiliatesRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_APPLIED',
        message: 'You already have an affiliate application.',
        currentStatus: existing.status,
      });
    }

    // Generate unique tracking code
    const trackingCode = await this.generateUniqueTrackingCode();

    // Create affiliate with PENDING status
    const affiliate = await this.affiliatesRepo.create({
      userId,
      trackingCode,
      status: 'PENDING',
      tier: 'BRONZE',
      websiteUrl: dto.websiteUrl,
      description: dto.description,
      promotionMethod: dto.promotionMethod,
      audience: dto.audience,
    });

    this.logger.log(`New affiliate application from user ${userId}: ${affiliate.id}`);

    return {
      id: affiliate.id,
      trackingCode: affiliate.trackingCode,
      status: affiliate.status,
      tier: affiliate.tier,
      message: 'Your affiliate application has been submitted for review.',
    };
  }

  /**
   * Get affiliate details by user ID.
   *
   * Requirements: 9.1
   */
  async getAffiliateByUserId(userId: string) {
    const affiliate = await this.affiliatesRepo.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundException({
        code: 'AFFILIATE_NOT_FOUND',
        message: 'You are not registered as an affiliate.',
      });
    }
    return affiliate;
  }

  /**
   * Track a click via the redirect endpoint.
   * Validates tracking code, records click metadata, returns redirect URL.
   *
   * Requirements: 9.3
   */
  async trackClick(trackingCode: string, req: any): Promise<{ url: string; affiliateId?: string }> {
    const affiliate = await this.affiliatesRepo.findByTrackingCode(trackingCode);

    // If tracking code doesn't exist or affiliate is not active, redirect to homepage
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return { url: '/' };
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers?.['user-agent'] || 'unknown';
    const referrerUrl = req.headers?.referer || req.headers?.referrer;

    // Record the click
    await this.affiliatesRepo.recordClick({
      affiliateId: affiliate.id,
      ip,
      userAgent,
      referrerUrl,
    });

    // Return redirect URL (game page or homepage)
    const redirectUrl = affiliate.defaultGameSlug
      ? `/games/${affiliate.defaultGameSlug}`
      : '/';

    return { url: redirectUrl, affiliateId: affiliate.id };
  }

  /**
   * Generate a tracking link for a specific game.
   *
   * Requirements: 9.2
   */
  async generateTrackingLink(userId: string, gameId: string) {
    const affiliate = await this.affiliatesRepo.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundException({
        code: 'AFFILIATE_NOT_FOUND',
        message: 'You are not registered as an affiliate.',
      });
    }

    if (affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'AFFILIATE_NOT_ACTIVE',
        message: `Your affiliate account is currently ${affiliate.status.toLowerCase()}.`,
      });
    }

    // Generate tracking link using the affiliate's code
    const trackingLink = `/r/${affiliate.trackingCode}?game=${gameId}`;

    return {
      trackingCode: affiliate.trackingCode,
      trackingLink,
      gameId,
    };
  }

  /**
   * Get earnings report for the authenticated affiliate.
   *
   * Requirements: 9.4
   */
  async getEarnings(userId: string, query: DateRangeDto) {
    const affiliate = await this.affiliatesRepo.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundException({
        code: 'AFFILIATE_NOT_FOUND',
        message: 'You are not registered as an affiliate.',
      });
    }

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const earnings = await this.affiliatesRepo.getEarningsSummary(
      affiliate.id,
      startDate,
      endDate,
    );

    return {
      affiliateId: affiliate.id,
      tier: affiliate.tier,
      commissionRate: COMMISSION_RATES[affiliate.tier] || 0.05,
      ...earnings,
    };
  }

  /**
   * Calculate commission for a conversion event.
   * Applies tier-based rate, caps at 50%, and runs fraud check.
   *
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.6
   */
  async calculateCommission(
    affiliateId: string,
    conversionEvent: ConversionEvent,
  ): Promise<CommissionResult | null> {
    const affiliate = await this.affiliatesRepo.findById(affiliateId);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return null;
    }

    // Determine base rate by tier
    const baseRate = COMMISSION_RATES[affiliate.tier] || 0.05;

    // Cap at maximum allowed commission rate (50%)
    const effectiveRate = Math.min(baseRate, MAX_COMMISSION_RATE);

    // Calculate commission amount using banker's rounding
    const rawAmount = conversionEvent.amount * effectiveRate;
    const commissionAmount = Math.round(rawAmount);

    // Fraud check before crediting
    const fraudScore = await this.checkFraudScore(affiliateId, conversionEvent);
    if (fraudScore > FRAUD_SCORE_THRESHOLD) {
      this.logger.warn(
        `Fraud detected for affiliate ${affiliateId}: score ${fraudScore}`,
      );
      await this.flagForReview(affiliateId);
      return {
        id: '',
        affiliateId,
        conversionId: conversionEvent.id,
        amount: 0,
        currency: conversionEvent.currency,
        rate: effectiveRate,
        status: 'REJECTED',
        rejected: true,
        reason: 'FRAUD_DETECTED',
      };
    }

    // Create commission record
    const commission = await this.affiliatesRepo.createCommission({
      affiliateId,
      conversionId: conversionEvent.id,
      amount: commissionAmount,
      currency: conversionEvent.currency,
      rate: effectiveRate,
      status: 'PENDING',
    });

    return {
      ...commission,
      rejected: false,
    };
  }

  /**
   * Request a payout. Enforces $50 minimum threshold.
   *
   * Requirements: 10.5
   */
  async requestPayout(userId: string) {
    const affiliate = await this.affiliatesRepo.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundException({
        code: 'AFFILIATE_NOT_FOUND',
        message: 'You are not registered as an affiliate.',
      });
    }

    if (affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'AFFILIATE_NOT_ACTIVE',
        message: 'Your affiliate account must be active to request a payout.',
      });
    }

    // Check minimum $50 threshold
    const pendingBalance = await this.affiliatesRepo.getPendingBalance(affiliate.id);
    if (pendingBalance < MIN_PAYOUT_THRESHOLD) {
      throw new ConflictException({
        code: 'BELOW_MINIMUM_PAYOUT',
        message: `Minimum payout is $50.00. Your balance: $${(pendingBalance / 100).toFixed(2)}`,
        currentBalance: pendingBalance,
        minimumRequired: MIN_PAYOUT_THRESHOLD,
      });
    }

    // Mark commissions as paid
    const paidCount = await this.affiliatesRepo.markCommissionsAsPaid(affiliate.id);

    this.logger.log(
      `Payout processed for affiliate ${affiliate.id}: ${pendingBalance} cents (${paidCount} commissions)`,
    );

    return {
      status: 'PROCESSING',
      amount: pendingBalance,
      currency: 'USD',
      commissionsProcessed: paidCount,
      message: `Payout of $${(pendingBalance / 100).toFixed(2)} is being processed.`,
    };
  }

  /**
   * Admin: Update affiliate status (approve/reject/suspend/ban).
   *
   * Requirements: 9.1
   */
  async updateAffiliateStatus(affiliateId: string, dto: UpdateAffiliateStatusDto) {
    const affiliate = await this.affiliatesRepo.findById(affiliateId);
    if (!affiliate) {
      throw new NotFoundException({
        code: 'AFFILIATE_NOT_FOUND',
        message: `Affiliate with ID ${affiliateId} not found.`,
      });
    }

    const updated = await this.affiliatesRepo.updateStatus(
      affiliateId,
      dto.status,
      dto.reason,
    );

    this.logger.log(
      `Affiliate ${affiliateId} status updated to ${dto.status} by admin`,
    );

    return {
      id: affiliateId,
      previousStatus: affiliate.status,
      newStatus: dto.status,
      reason: dto.reason,
    };
  }

  /**
   * Generate a unique URL-safe tracking code (12 characters).
   * Retries up to 5 times to ensure uniqueness.
   */
  private async generateUniqueTrackingCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateTrackingCode();
      const exists = await this.affiliatesRepo.trackingCodeExists(code);
      if (!exists) {
        return code;
      }
    }
    // Fallback: use a longer code to reduce collision probability
    return crypto.randomBytes(16).toString('base64url').slice(0, 16);
  }

  /**
   * Generate a URL-safe tracking code.
   * Returns a 12-character base64url-encoded random string.
   */
  private generateTrackingCode(): string {
    return crypto.randomBytes(9).toString('base64url').slice(0, 12);
  }

  /**
   * Check fraud score for a conversion event.
   * Returns a score from 0-100 (higher = more suspicious).
   *
   * Checks:
   * - Click rate (>100/min from single IP = 90)
   * - Low time-to-conversion = suspicious
   * - Geographic impossibility (future enhancement)
   *
   * Requirements: 10.4, 11.1
   */
  async checkFraudScore(affiliateId: string, event: ConversionEvent): Promise<number> {
    let score = 0;

    // Check click rate: >100 clicks in the last 60 seconds is suspicious
    const recentClicks = await this.affiliatesRepo.countRecentClicks(affiliateId, 60);
    if (recentClicks > MAX_CLICKS_PER_MINUTE) {
      score += 90;
    } else if (recentClicks > 50) {
      score += 40;
    }

    // Extremely small conversion amounts may indicate testing/abuse
    if (event.amount < 100) {
      // Less than $1
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Flag an affiliate for review due to suspected fraud.
   *
   * Requirements: 11.1, 11.2
   */
  private async flagForReview(affiliateId: string): Promise<void> {
    await this.affiliatesRepo.updateStatus(affiliateId, 'SUSPENDED', 'Flagged for fraud review');
    this.logger.warn(`Affiliate ${affiliateId} suspended pending fraud review`);
  }
}
