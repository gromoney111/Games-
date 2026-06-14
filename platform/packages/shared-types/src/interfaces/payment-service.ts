/**
 * IPaymentService Interface
 *
 * Contract for in-app purchases, payment processing, refunds,
 * and transaction management.
 */

import { TransactionId, UserId } from '../branded-types.js';
import { DateRange, PagedResult, Pagination } from '../utility-types.js';
import {
  Transaction,
  PurchaseRequest,
  PaymentIntent,
  Receipt,
  RefundResult,
} from '../models/transaction.js';

// ============================================================================
// Payment Service Interface
// ============================================================================

export interface IPaymentService {
  /**
   * Initiate a purchase for a user.
   * Validates eligibility, creates payment intent, records pending transaction.
   */
  initiatePurchase(userId: UserId, request: PurchaseRequest): Promise<PaymentIntent>;

  /**
   * Confirm a purchase after successful payment.
   * Marks transaction completed, grants item, sends notification.
   */
  confirmPurchase(transactionId: TransactionId, gatewayReference: string): Promise<Receipt>;

  /**
   * Process a refund for a completed transaction.
   * Validates refund amount does not exceed original.
   */
  refund(transactionId: TransactionId, reason: string): Promise<RefundResult>;

  /**
   * Get transaction history for a user within a date range.
   */
  getTransactionHistory(
    userId: UserId,
    dateRange: DateRange,
    pagination: Pagination,
  ): Promise<PagedResult<Transaction>>;

  /**
   * Get a specific transaction by ID.
   */
  getTransaction(transactionId: TransactionId): Promise<Transaction>;

  /**
   * Handle a payment gateway webhook event.
   * Processes payment.succeeded, payment.failed, etc.
   */
  handleWebhook(event: WebhookEvent): Promise<void>;

  /**
   * Check how many purchases a user has made in the rolling 24h window.
   */
  getDailyPurchaseCount(userId: UserId): Promise<number>;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
  signature: string;
  timestamp: Date;
}
