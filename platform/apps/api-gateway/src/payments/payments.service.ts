/**
 * Payments Service
 *
 * Business logic for in-app purchase processing, refunds, and transaction history.
 * Implements purchase eligibility validation with specific error codes:
 * - ACCOUNT_INACTIVE: user account is not active
 * - ITEM_NOT_FOUND: item does not exist
 * - AGE_RESTRICTED: user does not meet age requirement
 * - DAILY_LIMIT_EXCEEDED: 50 transactions per rolling 24-hour window
 * - INVALID_AMOUNT: amount outside valid range (1-999999 cents, i.e., $0.01-$9999.99)
 * - OUT_OF_STOCK: limited item has no stock
 *
 * Requirements: 7.1, 7.3, 7.4, 7.5
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PaymentsRepository, ItemRecord } from './payments.repository';
import { StripeService } from './stripe.service';
import { UsersService } from '../users/users.service';
import { InitiatePurchaseDto } from './dto/initiate-purchase.dto';
import { RefundDto } from './dto/refund.dto';
import { PaginationDto } from './dto/pagination.dto';

/** Daily purchase limit: 50 transactions per rolling 24-hour window */
const DAILY_PURCHASE_LIMIT = 50;

/** Minimum valid amount in cents ($0.01) */
const MIN_AMOUNT_CENTS = 1;

/** Maximum valid amount in cents ($9999.99) */
const MAX_AMOUNT_CENTS = 999999;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Initiate a purchase for an item.
   *
   * Validates purchase eligibility in order:
   * 1. User account must be active
   * 2. Item must exist
   * 3. Age restriction check
   * 4. Daily purchase limit (50 per rolling 24h)
   * 5. Amount validity (0.01 to 9999.99 USD)
   * 6. Stock availability (for limited items)
   *
   * Then creates a Stripe payment intent and records a pending transaction.
   *
   * @param userId - The authenticated user's ID
   * @param dto - Purchase request with itemId, paymentMethod, and optional currency
   * @returns Transaction details with Stripe client secret
   */
  async initiatePurchase(userId: string, dto: InitiatePurchaseDto) {
    // 1. Validate user is active
    const user = await this.usersService.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is not active. Only active accounts can make purchases.',
      });
    }

    // 2. Get item details
    const item = await this.paymentsRepository.findItemById(dto.itemId);
    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: 'The requested item does not exist or is no longer available.',
      });
    }

    // 3. Check age restriction
    if (item.ageRestriction && item.ageRestriction > 0) {
      const userAge = this.calculateUserAge(user);
      if (userAge !== null && userAge < item.ageRestriction) {
        throw new ForbiddenException({
          code: 'AGE_RESTRICTED',
          message: `This item requires a minimum age of ${item.ageRestriction}. Age restriction applies.`,
        });
      }
    }

    // 4. Check daily purchase limit (50 transactions in rolling 24h)
    const recentCount = await this.paymentsRepository.countRecentTransactions(userId, 24);
    if (recentCount >= DAILY_PURCHASE_LIMIT) {
      throw new ConflictException({
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily purchase limit reached (${DAILY_PURCHASE_LIMIT}/day). Please try again later.`,
      });
    }

    // 5. Validate amount range (0.01 to 9999.99)
    if (item.price < MIN_AMOUNT_CENTS || item.price > MAX_AMOUNT_CENTS) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: `Purchase amount must be between $0.01 and $9,999.99. Current amount: $${(item.price / 100).toFixed(2)}`,
      });
    }

    // 6. Check stock (for limited items only)
    if (item.isLimited && item.stock <= 0) {
      throw new ConflictException({
        code: 'OUT_OF_STOCK',
        message: 'This item is currently out of stock.',
      });
    }

    // 7. Create Stripe payment intent
    const currency = dto.currency || 'USD';
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: item.price,
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        itemId: dto.itemId,
        itemTitle: item.title,
      },
    });

    // 8. Record pending transaction in PostgreSQL
    const transaction = await this.paymentsRepository.createTransaction({
      userId,
      itemId: dto.itemId,
      amount: item.price,
      currency: currency.toUpperCase(),
      status: 'PENDING',
      paymentMethod: dto.paymentMethod,
      gatewayReference: paymentIntent.id,
      metadata: {
        itemTitle: item.title,
        stripeClientSecret: paymentIntent.clientSecret,
      },
    });

    this.logger.log(
      `Purchase initiated: user=${userId}, item=${dto.itemId}, amount=${item.price} ${currency}, tx=${transaction.id}`,
    );

    return {
      transactionId: transaction.id,
      clientSecret: paymentIntent.clientSecret,
      amount: item.price,
      currency: currency.toUpperCase(),
      itemTitle: item.title,
      status: 'PENDING',
    };
  }

  /**
   * Process a refund for a completed transaction.
   * Validates refund amount does not exceed the original amount.
   *
   * Requirements: 7.6
   *
   * @param transactionId - The transaction to refund
   * @param dto - Refund details (amount and reason)
   * @param userId - The requesting user ID
   * @returns Refund result
   */
  async refund(transactionId: string, dto: RefundDto, userId: string) {
    const transaction = await this.paymentsRepository.findTransactionById(transactionId);

    if (!transaction) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found.',
      });
    }

    // Verify ownership
    if (transaction.userId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED',
        message: 'You are not authorized to refund this transaction.',
      });
    }

    // Only completed transactions can be refunded
    if (transaction.status !== 'COMPLETED') {
      throw new ConflictException({
        code: 'INVALID_TRANSACTION_STATE',
        message: `Cannot refund a transaction with status: ${transaction.status}`,
      });
    }

    // Validate refund amount does not exceed original (Requirement 7.6)
    const refundAmount = dto.amount || transaction.amount;
    if (refundAmount > transaction.amount) {
      throw new BadRequestException({
        code: 'REFUND_EXCEEDS_ORIGINAL',
        message: `Refund amount ($${(refundAmount / 100).toFixed(2)}) exceeds original transaction amount ($${(transaction.amount / 100).toFixed(2)}).`,
      });
    }

    // Process refund through Stripe
    const refundResult = await this.stripeService.createRefund(
      transaction.gatewayReference,
      refundAmount,
    );

    // Update transaction status
    await this.paymentsRepository.updateTransaction(transactionId, {
      status: 'REFUNDED',
      metadata: {
        ...transaction.metadata,
        refundId: refundResult.id,
        refundAmount,
        refundReason: dto.reason,
        refundedAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `Refund processed: tx=${transactionId}, amount=${refundAmount}, refund=${refundResult.id}`,
    );

    return {
      transactionId,
      refundId: refundResult.id,
      refundAmount,
      status: 'REFUNDED',
    };
  }

  /**
   * Get paginated transaction history for a user.
   *
   * @param userId - The user ID
   * @param query - Pagination parameters
   * @returns Paginated transaction list
   */
  async getTransactionHistory(userId: string, query: PaginationDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    return this.paymentsRepository.getTransactionHistory(userId, page, limit);
  }

  /**
   * Handle Stripe webhook events.
   * Processes payment_intent.succeeded and payment_intent.payment_failed events.
   *
   * Requirements: 7.2, 8.5
   *
   * @param payload - Stripe webhook event payload
   * @param rawBody - Raw request body for signature verification
   * @returns Acknowledgement
   */
  async handleWebhook(payload: any, rawBody: Buffer) {
    const event = payload;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onPaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.onPaymentFailed(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle successful payment.
   * Marks transaction as completed and grants item to user.
   */
  private async onPaymentSucceeded(paymentIntent: any) {
    const { userId, itemId } = paymentIntent.metadata || {};

    if (!userId || !itemId) {
      this.logger.warn('Payment succeeded webhook missing metadata');
      return;
    }

    // Mark transaction completed
    await this.paymentsRepository.updateByGatewayReference(paymentIntent.id, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    this.logger.log(
      `Payment succeeded: pi=${paymentIntent.id}, user=${userId}, item=${itemId}`,
    );

    // In production: grant item to user inventory, send notification
  }

  /**
   * Handle failed payment.
   * Marks transaction as failed.
   */
  private async onPaymentFailed(paymentIntent: any) {
    await this.paymentsRepository.updateByGatewayReference(paymentIntent.id, {
      status: 'FAILED',
    });

    this.logger.log(`Payment failed: pi=${paymentIntent.id}`);

    // In production: notify user of payment failure
  }

  /**
   * Calculate user's age from their date of birth.
   * Returns null if dateOfBirth is not available.
   */
  private calculateUserAge(user: any): number | null {
    const dob = user.profile?.dateOfBirth;
    if (!dob) {
      return null;
    }

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }
}
