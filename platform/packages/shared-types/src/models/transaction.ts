/**
 * Transaction Data Models
 *
 * Types for in-app purchases, payments, refunds, and monetary operations.
 */

import {
  TransactionId,
  UserId,
  ItemId,
  CurrencyCode,
} from '../branded-types.js';
import { TransactionStatus, PaymentMethod } from '../enums.js';
import { Timestamps } from '../utility-types.js';

// ============================================================================
// Money
// ============================================================================

export interface Money {
  /** Amount stored as smallest unit (cents) */
  amount: number;
  currency: CurrencyCode;
}

// ============================================================================
// Transaction
// ============================================================================

export interface Transaction extends Timestamps {
  id: TransactionId;
  userId: UserId;
  itemId: ItemId;
  amount: Money;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  gatewayReference: string;
  metadata: TransactionMetadata;
  completedAt?: Date;
  refundedAt?: Date;
}

export interface TransactionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  stateHistory: TransactionStateChange[];
}

export interface TransactionStateChange {
  fromStatus: TransactionStatus;
  toStatus: TransactionStatus;
  timestamp: Date;
  reason?: string;
  gatewayReference?: string;
}

// ============================================================================
// Purchase Request
// ============================================================================

export interface PurchaseRequest {
  itemId: ItemId;
  paymentMethod: PaymentMethod;
  currency: CurrencyCode;
}

export interface PaymentIntent {
  transactionId: TransactionId;
  clientSecret: string;
  amount: Money;
  paymentMethod: PaymentMethod;
  expiresAt: Date;
}

// ============================================================================
// Purchasable Item
// ============================================================================

export interface PurchasableItem {
  id: ItemId;
  name: string;
  description: string;
  price: Money;
  category: string;
  isLimited: boolean;
  stock?: number;
  ageRestriction?: number;
}

// ============================================================================
// Receipt and Refund
// ============================================================================

export interface Receipt {
  transactionId: TransactionId;
  userId: UserId;
  item: PurchasableItem;
  amount: Money;
  paymentMethod: PaymentMethod;
  purchasedAt: Date;
  receiptNumber: string;
}

export interface RefundResult {
  transactionId: TransactionId;
  refundAmount: Money;
  originalAmount: Money;
  reason: string;
  refundedAt: Date;
  gatewayRefundId: string;
}
