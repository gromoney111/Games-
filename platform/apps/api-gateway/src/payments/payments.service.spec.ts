/**
 * Unit Tests: PaymentsService
 *
 * Tests purchase eligibility validation with specific error codes:
 * - ACCOUNT_INACTIVE
 * - ITEM_NOT_FOUND
 * - AGE_RESTRICTED
 * - DAILY_LIMIT_EXCEEDED
 * - INVALID_AMOUNT
 * - OUT_OF_STOCK
 *
 * Also tests webhook processing and refund logic.
 *
 * Requirements: 7.1, 7.3, 7.4, 7.5, 7.6
 */

import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { StripeService } from './stripe.service';
import { UsersService } from '../users/users.service';
import { PaymentMethod } from './dto/initiate-purchase.dto';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepository: jest.Mocked<PaymentsRepository>;
  let stripeService: jest.Mocked<StripeService>;
  let usersService: jest.Mocked<UsersService>;

  const mockActiveUser = {
    id: 'user-123',
    email: 'test@example.com',
    status: 'ACTIVE',
    role: 'PLAYER',
    profile: {
      dateOfBirth: '1990-01-01',
    },
  };

  const mockItem = {
    id: 'item-456',
    title: 'Premium Sword',
    price: 999, // $9.99 in cents
    currency: 'USD',
    ageRestriction: 0,
    isLimited: false,
    stock: 100,
    status: 'ACTIVE',
  };

  const mockPaymentIntent = {
    id: 'pi_test123',
    clientSecret: 'pi_test123_secret_abc',
    status: 'requires_payment_method',
    amount: 999,
    currency: 'usd',
  };

  const mockTransaction = {
    id: 'tx-789',
    userId: 'user-123',
    itemId: 'item-456',
    amount: 999,
    currency: 'USD',
    status: 'PENDING',
    paymentMethod: 'credit_card',
    gatewayReference: 'pi_test123',
    metadata: { itemTitle: 'Premium Sword' },
    createdAt: new Date(),
  };

  beforeEach(() => {
    paymentsRepository = {
      countRecentTransactions: jest.fn().mockResolvedValue(0),
      createTransaction: jest.fn().mockResolvedValue(mockTransaction),
      findTransactionById: jest.fn().mockResolvedValue(null),
      findByGatewayReference: jest.fn().mockResolvedValue(null),
      updateTransaction: jest.fn().mockResolvedValue(mockTransaction),
      updateByGatewayReference: jest.fn().mockResolvedValue(mockTransaction),
      getTransactionHistory: jest.fn().mockResolvedValue({ transactions: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      findItemById: jest.fn().mockResolvedValue(mockItem),
    } as any;

    stripeService = {
      createPaymentIntent: jest.fn().mockResolvedValue(mockPaymentIntent),
      createRefund: jest.fn().mockResolvedValue({ id: 're_test', amount: 999, status: 'succeeded' }),
      getPaymentIntentStatus: jest.fn().mockResolvedValue('requires_payment_method'),
    } as any;

    usersService = {
      findById: jest.fn().mockResolvedValue(mockActiveUser),
    } as any;

    service = new PaymentsService(paymentsRepository, stripeService, usersService);
  });

  describe('initiatePurchase', () => {
    const validDto = {
      itemId: 'item-456',
      paymentMethod: PaymentMethod.CREDIT_CARD,
      currency: 'USD',
    };

    it('should successfully initiate a purchase for an eligible user', async () => {
      const result = await service.initiatePurchase('user-123', validDto);

      expect(result).toEqual({
        transactionId: 'tx-789',
        clientSecret: 'pi_test123_secret_abc',
        amount: 999,
        currency: 'USD',
        itemTitle: 'Premium Sword',
        status: 'PENDING',
      });

      expect(usersService.findById).toHaveBeenCalledWith('user-123');
      expect(paymentsRepository.findItemById).toHaveBeenCalledWith('item-456');
      expect(paymentsRepository.countRecentTransactions).toHaveBeenCalledWith('user-123', 24);
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 999,
        currency: 'usd',
        metadata: { userId: 'user-123', itemId: 'item-456', itemTitle: 'Premium Sword' },
      });
      expect(paymentsRepository.createTransaction).toHaveBeenCalled();
    });

    it('should throw ACCOUNT_INACTIVE when user is not active', async () => {
      usersService.findById.mockResolvedValue({ ...mockActiveUser, status: 'SUSPENDED' });

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(ForbiddenException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'ACCOUNT_INACTIVE',
          message: expect.any(String),
        });
      }
    });

    it('should throw ACCOUNT_INACTIVE when user is not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should throw ITEM_NOT_FOUND when item does not exist', async () => {
      paymentsRepository.findItemById.mockResolvedValue(null);

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(NotFoundException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'ITEM_NOT_FOUND',
          message: expect.any(String),
        });
      }
    });

    it('should throw AGE_RESTRICTED when user is underage for age-restricted item', async () => {
      // User is 15 years old
      const youngUser = {
        ...mockActiveUser,
        profile: { dateOfBirth: new Date(Date.now() - 15 * 365.25 * 24 * 60 * 60 * 1000).toISOString() },
      };
      usersService.findById.mockResolvedValue(youngUser);

      // Item requires age 18+
      paymentsRepository.findItemById.mockResolvedValue({ ...mockItem, ageRestriction: 18 });

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(ForbiddenException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'AGE_RESTRICTED',
          message: expect.any(String),
        });
      }
    });

    it('should allow purchase when user meets age requirement', async () => {
      // User is 25 years old
      const adultUser = {
        ...mockActiveUser,
        profile: { dateOfBirth: new Date(Date.now() - 25 * 365.25 * 24 * 60 * 60 * 1000).toISOString() },
      };
      usersService.findById.mockResolvedValue(adultUser);

      // Item requires age 18+
      paymentsRepository.findItemById.mockResolvedValue({ ...mockItem, ageRestriction: 18 });

      const result = await service.initiatePurchase('user-123', validDto);
      expect(result.transactionId).toBe('tx-789');
    });

    it('should skip age check when user has no dateOfBirth', async () => {
      usersService.findById.mockResolvedValue({ ...mockActiveUser, profile: {} });
      paymentsRepository.findItemById.mockResolvedValue({ ...mockItem, ageRestriction: 18 });

      // Should NOT throw because we can't verify age
      const result = await service.initiatePurchase('user-123', validDto);
      expect(result.transactionId).toBe('tx-789');
    });

    it('should throw DAILY_LIMIT_EXCEEDED when 50 transactions in 24h', async () => {
      paymentsRepository.countRecentTransactions.mockResolvedValue(50);

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(ConflictException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'DAILY_LIMIT_EXCEEDED',
          message: expect.any(String),
        });
      }
    });

    it('should allow purchase at 49 transactions (under limit)', async () => {
      paymentsRepository.countRecentTransactions.mockResolvedValue(49);

      const result = await service.initiatePurchase('user-123', validDto);
      expect(result.transactionId).toBe('tx-789');
    });

    it('should throw INVALID_AMOUNT when price is below minimum (0 cents)', async () => {
      paymentsRepository.findItemById.mockResolvedValue({ ...mockItem, price: 0 });

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(BadRequestException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'INVALID_AMOUNT',
          message: expect.any(String),
        });
      }
    });

    it('should throw INVALID_AMOUNT when price exceeds maximum (1000000 cents)', async () => {
      paymentsRepository.findItemById.mockResolvedValue({ ...mockItem, price: 1000000 });

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw OUT_OF_STOCK when limited item has zero stock', async () => {
      paymentsRepository.findItemById.mockResolvedValue({
        ...mockItem,
        isLimited: true,
        stock: 0,
      });

      await expect(service.initiatePurchase('user-123', validDto))
        .rejects
        .toThrow(ConflictException);

      try {
        await service.initiatePurchase('user-123', validDto);
      } catch (error: any) {
        expect(error.getResponse()).toEqual({
          code: 'OUT_OF_STOCK',
          message: expect.any(String),
        });
      }
    });

    it('should allow purchase of non-limited item even with 0 stock', async () => {
      paymentsRepository.findItemById.mockResolvedValue({
        ...mockItem,
        isLimited: false,
        stock: 0,
      });

      const result = await service.initiatePurchase('user-123', validDto);
      expect(result.transactionId).toBe('tx-789');
    });

    it('should use default USD currency when none specified', async () => {
      const dtoWithoutCurrency = { itemId: 'item-456', paymentMethod: PaymentMethod.CREDIT_CARD };

      await service.initiatePurchase('user-123', dtoWithoutCurrency as any);

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'usd' }),
      );
    });
  });

  describe('refund', () => {
    const completedTransaction = {
      ...mockTransaction,
      status: 'COMPLETED',
      amount: 999,
    };

    it('should throw TRANSACTION_NOT_FOUND when transaction does not exist', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue(null);

      await expect(service.refund('tx-999', { reason: 'Not satisfied' }, 'user-123'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw NOT_AUTHORIZED when user does not own transaction', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue({
        ...completedTransaction,
        userId: 'other-user',
      });

      await expect(service.refund('tx-789', { reason: 'Not satisfied' }, 'user-123'))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should throw INVALID_TRANSACTION_STATE for non-completed transactions', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue({
        ...completedTransaction,
        status: 'PENDING',
      });

      await expect(service.refund('tx-789', { reason: 'Not satisfied' }, 'user-123'))
        .rejects
        .toThrow(ConflictException);
    });

    it('should throw REFUND_EXCEEDS_ORIGINAL when refund amount exceeds original', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue(completedTransaction);

      await expect(
        service.refund('tx-789', { amount: 1500, reason: 'Overcharge' }, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process full refund when no amount specified', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue(completedTransaction);

      const result = await service.refund('tx-789', { reason: 'Not satisfied' }, 'user-123');

      expect(result.status).toBe('REFUNDED');
      expect(stripeService.createRefund).toHaveBeenCalledWith('pi_test123', 999);
    });

    it('should process partial refund when amount is less than original', async () => {
      paymentsRepository.findTransactionById.mockResolvedValue(completedTransaction);

      const result = await service.refund('tx-789', { amount: 500, reason: 'Partial' }, 'user-123');

      expect(result.status).toBe('REFUNDED');
      expect(result.refundAmount).toBe(500);
      expect(stripeService.createRefund).toHaveBeenCalledWith('pi_test123', 500);
    });
  });

  describe('handleWebhook', () => {
    it('should mark transaction as COMPLETED on payment_intent.succeeded', async () => {
      const payload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            metadata: { userId: 'user-123', itemId: 'item-456' },
          },
        },
      };

      const result = await service.handleWebhook(payload, Buffer.from(''));

      expect(result).toEqual({ received: true });
      expect(paymentsRepository.updateByGatewayReference).toHaveBeenCalledWith('pi_test123', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      });
    });

    it('should mark transaction as FAILED on payment_intent.payment_failed', async () => {
      const payload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: { id: 'pi_test123', metadata: {} },
        },
      };

      const result = await service.handleWebhook(payload, Buffer.from(''));

      expect(result).toEqual({ received: true });
      expect(paymentsRepository.updateByGatewayReference).toHaveBeenCalledWith('pi_test123', {
        status: 'FAILED',
      });
    });

    it('should handle unknown event types gracefully', async () => {
      const payload = {
        type: 'unknown.event',
        data: { object: {} },
      };

      const result = await service.handleWebhook(payload, Buffer.from(''));
      expect(result).toEqual({ received: true });
    });
  });

  describe('getTransactionHistory', () => {
    it('should return paginated transaction history', async () => {
      const mockHistory = {
        transactions: [mockTransaction],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      paymentsRepository.getTransactionHistory.mockResolvedValue(mockHistory);

      const result = await service.getTransactionHistory('user-123', { page: 1, limit: 20 });

      expect(result).toEqual(mockHistory);
      expect(paymentsRepository.getTransactionHistory).toHaveBeenCalledWith('user-123', 1, 20);
    });
  });
});
