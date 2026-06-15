/**
 * Payments Repository
 *
 * Database access layer for transaction operations via Prisma ORM.
 * Provides CRUD for transactions and items, plus query support for
 * daily purchase limit enforcement and transaction history.
 *
 * Requirements: 7.1, 7.4, 8.5
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTransactionData {
  userId: string;
  itemId: string;
  amount: number; // in cents
  currency: string;
  status: string;
  paymentMethod: string;
  gatewayReference: string;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionData {
  status?: string;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ItemRecord {
  id: string;
  title: string;
  price: number; // in cents
  currency: string;
  ageRestriction?: number;
  isLimited: boolean;
  stock: number;
  status: string;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Count transactions for a user within a rolling time window.
   * Used to enforce the daily purchase limit (50 per 24h).
   *
   * @param userId - The user ID
   * @param hours - Number of hours to look back
   * @returns Count of transactions in the window
   */
  async countRecentTransactions(userId: string, hours: number): Promise<number> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.prisma.transaction.count({
      where: {
        userId,
        createdAt: { gte: since },
        status: { in: ['PENDING', 'COMPLETED'] },
      },
    });
  }

  /**
   * Create a new transaction record.
   */
  async createTransaction(data: CreateTransactionData) {
    return this.prisma.transaction.create({
      data: {
        userId: data.userId,
        itemId: data.itemId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        paymentMethod: data.paymentMethod,
        gatewayReference: data.gatewayReference,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Find a transaction by ID.
   */
  async findTransactionById(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
    });
  }

  /**
   * Find a transaction by gateway reference (e.g., Stripe payment intent ID).
   */
  async findByGatewayReference(gatewayReference: string) {
    return this.prisma.transaction.findFirst({
      where: { gatewayReference },
    });
  }

  /**
   * Update a transaction by ID.
   */
  async updateTransaction(id: string, data: UpdateTransactionData) {
    return this.prisma.transaction.update({
      where: { id },
      data,
    });
  }

  /**
   * Update a transaction by gateway reference.
   */
  async updateByGatewayReference(gatewayReference: string, data: UpdateTransactionData) {
    const transaction = await this.findByGatewayReference(gatewayReference);
    if (!transaction) {
      return null;
    }
    return this.prisma.transaction.update({
      where: { id: transaction.id },
      data,
    });
  }

  /**
   * Get paginated transaction history for a user.
   */
  async getTransactionHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find an item by ID from the items catalog.
   * Simulates item lookup from the game/items table.
   */
  async findItemById(itemId: string): Promise<ItemRecord | null> {
    // In production, this queries an 'items' or 'game_items' table.
    // For now using Prisma's generic approach.
    try {
      const item = await (this.prisma as any).item?.findUnique({
        where: { id: itemId },
      });
      return item || null;
    } catch {
      // If the item model doesn't exist yet, return null
      return null;
    }
  }
}
