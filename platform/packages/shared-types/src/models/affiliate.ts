/**
 * Affiliate Data Models
 *
 * Types for the affiliate program: registration, tracking, commissions, and payouts.
 */

import {
  AffiliateId,
  UserId,
  GameId,
  CommissionId,
  TrackingCode,
  CurrencyCode,
  Url,
} from '../branded-types.js';
import { AffiliateTier, AffiliateStatus, CommissionStatus } from '../enums.js';
import { Timestamps, DateRange } from '../utility-types.js';
import { Money } from './transaction.js';

// ============================================================================
// Affiliate
// ============================================================================

export interface Affiliate extends Timestamps {
  id: AffiliateId;
  userId: UserId;
  status: AffiliateStatus;
  tier: AffiliateTier;
  commissionRate: number;
  trackingCode: TrackingCode;
  earnings: AffiliateEarnings;
  payoutInfo: PayoutInfo;
  applicationDate: Date;
  approvedAt?: Date;
  fraudScore: number;
}

// ============================================================================
// Affiliate Earnings
// ============================================================================

export interface AffiliateEarnings {
  totalEarned: Money;
  pendingPayout: Money;
  lifetimeClicks: number;
  lifetimeConversions: number;
  conversionRate: number;
  lastPayoutDate?: Date;
}

// ============================================================================
// Commission
// ============================================================================

export interface Commission extends Timestamps {
  id: CommissionId;
  affiliateId: AffiliateId;
  conversionEventId: string;
  amount: Money;
  rate: number;
  status: CommissionStatus;
  paidAt?: Date;
}

// ============================================================================
// Tracking Link
// ============================================================================

export interface TrackingLink {
  code: TrackingCode;
  affiliateId: AffiliateId;
  gameId?: GameId;
  targetUrl: Url;
  fullUrl: Url;
  createdAt: Date;
}

// ============================================================================
// Conversion Event
// ============================================================================

export interface ConversionEvent {
  id: string;
  trackingCode: TrackingCode;
  userId: UserId;
  eventType: 'registration' | 'purchase' | 'subscription';
  amount: Money;
  gameId?: GameId;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Payout
// ============================================================================

export interface PayoutInfo {
  method: 'bank_transfer' | 'paypal' | 'crypto';
  accountDetails: Record<string, string>;
  currency: CurrencyCode;
  minimumThreshold: Money;
}

export interface PayoutRequest {
  affiliateId: AffiliateId;
  amount: Money;
  payoutInfo: PayoutInfo;
  requestedAt: Date;
  period: DateRange;
}

export interface PayoutResult {
  affiliateId: AffiliateId;
  amount: Money;
  transactionReference: string;
  processedAt: Date;
  status: 'completed' | 'failed' | 'pending';
}
