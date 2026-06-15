/**
 * Unit Tests: AffiliatesService
 *
 * Tests affiliate program business logic:
 * - Affiliate registration and application workflow
 * - Click tracking via redirect endpoint
 * - Commission calculation based on tiers (Bronze 5%, Silver 10%, Gold 15%, Platinum 20%)
 * - 50% maximum commission cap
 * - Fraud detection (>100 clicks/min from single IP)
 * - Payout threshold enforcement ($50 minimum)
 * - Admin approval/rejection workflow
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  AffiliatesService,
  COMMISSION_RATES,
  MAX_COMMISSION_RATE,
  MIN_PAYOUT_THRESHOLD,
  FRAUD_SCORE_THRESHOLD,
  ConversionEvent,
} from './affiliates.service';
import { AffiliatesRepository } from './affiliates.repository';

describe('AffiliatesService', () => {
  let service: AffiliatesService;
  let affiliatesRepo: jest.Mocked<AffiliatesRepository>;

  const mockActiveAffiliate = {
    id: 'aff-123',
    userId: 'user-456',
    trackingCode: 'abc123def456',
    status: 'ACTIVE',
    tier: 'BRONZE',
    websiteUrl: 'https://example.com',
    description: 'A test affiliate for gaming promotions',
    defaultGameSlug: 'chess',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPendingAffiliate = {
    ...mockActiveAffiliate,
    id: 'aff-789',
    status: 'PENDING',
  };

  const mockConversionEvent: ConversionEvent = {
    id: 'conv-001',
    userId: 'buyer-100',
    eventType: 'purchase',
    amount: 1000, // $10.00 in cents
    currency: 'USD',
    gameId: 'game-50',
  };

  beforeEach(() => {
    affiliatesRepo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({
        id: 'aff-new',
        ...data,
        defaultGameSlug: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findByUserId: jest.fn().mockResolvedValue(null),
      findByTrackingCode: jest.fn().mockResolvedValue(mockActiveAffiliate),
      findById: jest.fn().mockResolvedValue(mockActiveAffiliate),
      updateStatus: jest.fn().mockResolvedValue(mockActiveAffiliate),
      trackingCodeExists: jest.fn().mockResolvedValue(false),
      recordClick: jest.fn().mockResolvedValue({ id: 'click-1', affiliateId: 'aff-123', ip: '1.2.3.4', userAgent: 'test', createdAt: new Date() }),
      countRecentClicks: jest.fn().mockResolvedValue(0),
      countRecentClicksFromIp: jest.fn().mockResolvedValue(0),
      createCommission: jest.fn().mockResolvedValue({
        id: 'comm-001',
        affiliateId: 'aff-123',
        conversionId: 'conv-001',
        amount: 50,
        currency: 'USD',
        rate: 0.05,
        status: 'PENDING',
        createdAt: new Date(),
      }),
      getPendingBalance: jest.fn().mockResolvedValue(0),
      getEarningsSummary: jest.fn().mockResolvedValue({
        totalEarned: 500,
        pendingPayout: 200,
        totalClicks: 100,
        totalConversions: 5,
        conversionRate: 0.05,
      }),
      markCommissionsAsPaid: jest.fn().mockResolvedValue(3),
    } as any;

    service = new AffiliatesService(affiliatesRepo);
  });

  describe('apply', () => {
    const validApplication = {
      websiteUrl: 'https://mygamesite.com',
      description: 'I run a gaming blog with 10k monthly visitors',
      promotionMethod: 'Blog posts and social media',
      audience: 'Casual gamers aged 18-35',
    };

    it('should create a new affiliate application with PENDING status', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);

      const result = await service.apply('user-456', validApplication);

      expect(result.status).toBe('PENDING');
      expect(result.trackingCode).toBeDefined();
      expect(result.message).toContain('submitted for review');
      expect(affiliatesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          status: 'PENDING',
          tier: 'BRONZE',
          websiteUrl: validApplication.websiteUrl,
          description: validApplication.description,
        }),
      );
    });

    it('should throw ALREADY_APPLIED if user already has an application', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockPendingAffiliate);

      await expect(service.apply('user-456', validApplication))
        .rejects
        .toThrow(ConflictException);

      try {
        await service.apply('user-456', validApplication);
      } catch (error: any) {
        expect(error.getResponse()).toEqual(
          expect.objectContaining({ code: 'ALREADY_APPLIED' }),
        );
      }
    });

    it('should generate a unique tracking code', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);

      const result = await service.apply('user-456', validApplication);

      expect(affiliatesRepo.trackingCodeExists).toHaveBeenCalled();
      expect(affiliatesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          trackingCode: expect.any(String),
        }),
      );
    });

    it('should retry tracking code generation on collision', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);
      affiliatesRepo.trackingCodeExists
        .mockResolvedValueOnce(true) // First code exists
        .mockResolvedValueOnce(false); // Second code is unique

      await service.apply('user-456', validApplication);

      expect(affiliatesRepo.trackingCodeExists).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackClick', () => {
    const mockRequest = {
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'Mozilla/5.0',
        referer: 'https://google.com',
      },
      connection: { remoteAddress: '192.168.1.1' },
    };

    it('should record click and return redirect URL for active affiliate', async () => {
      affiliatesRepo.findByTrackingCode.mockResolvedValue(mockActiveAffiliate);

      const result = await service.trackClick('abc123def456', mockRequest);

      expect(result.url).toBe('/games/chess');
      expect(result.affiliateId).toBe('aff-123');
      expect(affiliatesRepo.recordClick).toHaveBeenCalledWith({
        affiliateId: 'aff-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        referrerUrl: 'https://google.com',
      });
    });

    it('should redirect to homepage for invalid tracking code', async () => {
      affiliatesRepo.findByTrackingCode.mockResolvedValue(null);

      const result = await service.trackClick('invalid-code', mockRequest);

      expect(result.url).toBe('/');
      expect(result.affiliateId).toBeUndefined();
      expect(affiliatesRepo.recordClick).not.toHaveBeenCalled();
    });

    it('should redirect to homepage for inactive affiliate', async () => {
      affiliatesRepo.findByTrackingCode.mockResolvedValue({
        ...mockActiveAffiliate,
        status: 'SUSPENDED',
      });

      const result = await service.trackClick('abc123def456', mockRequest);

      expect(result.url).toBe('/');
      expect(affiliatesRepo.recordClick).not.toHaveBeenCalled();
    });

    it('should redirect to homepage when affiliate has no default game', async () => {
      affiliatesRepo.findByTrackingCode.mockResolvedValue({
        ...mockActiveAffiliate,
        defaultGameSlug: undefined,
      });

      const result = await service.trackClick('abc123def456', mockRequest);

      expect(result.url).toBe('/');
    });
  });

  describe('calculateCommission', () => {
    it('should calculate 5% commission for BRONZE tier', async () => {
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, tier: 'BRONZE' });

      const result = await service.calculateCommission('aff-123', mockConversionEvent);

      expect(result).not.toBeNull();
      expect(result!.rejected).toBe(false);
      // 5% of 1000 cents = 50 cents
      expect(affiliatesRepo.createCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          rate: 0.05,
        }),
      );
    });

    it('should calculate 10% commission for SILVER tier', async () => {
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, tier: 'SILVER' });

      await service.calculateCommission('aff-123', mockConversionEvent);

      expect(affiliatesRepo.createCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100, // 10% of 1000
          rate: 0.10,
        }),
      );
    });

    it('should calculate 15% commission for GOLD tier', async () => {
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, tier: 'GOLD' });

      await service.calculateCommission('aff-123', mockConversionEvent);

      expect(affiliatesRepo.createCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 150, // 15% of 1000
          rate: 0.15,
        }),
      );
    });

    it('should calculate 20% commission for PLATINUM tier', async () => {
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, tier: 'PLATINUM' });

      await service.calculateCommission('aff-123', mockConversionEvent);

      expect(affiliatesRepo.createCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 200, // 20% of 1000
          rate: 0.20,
        }),
      );
    });

    it('should cap commission rate at 50% maximum', async () => {
      // Even if somehow the base rate exceeded 50%, it should be capped
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, tier: 'PLATINUM' });

      const largeEvent = { ...mockConversionEvent, amount: 10000 };
      await service.calculateCommission('aff-123', largeEvent);

      // 20% of 10000 = 2000, which is less than 50% cap so normal rate applies
      expect(affiliatesRepo.createCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          rate: 0.20,
        }),
      );
    });

    it('should return null for inactive affiliate', async () => {
      affiliatesRepo.findById.mockResolvedValue({ ...mockActiveAffiliate, status: 'SUSPENDED' });

      const result = await service.calculateCommission('aff-123', mockConversionEvent);

      expect(result).toBeNull();
      expect(affiliatesRepo.createCommission).not.toHaveBeenCalled();
    });

    it('should return null for non-existent affiliate', async () => {
      affiliatesRepo.findById.mockResolvedValue(null);

      const result = await service.calculateCommission('aff-999', mockConversionEvent);

      expect(result).toBeNull();
    });

    it('should reject commission and flag for review when fraud score exceeds threshold', async () => {
      affiliatesRepo.findById.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.countRecentClicks.mockResolvedValue(150); // >100/min = fraud

      const result = await service.calculateCommission('aff-123', mockConversionEvent);

      expect(result).not.toBeNull();
      expect(result!.rejected).toBe(true);
      expect(result!.reason).toBe('FRAUD_DETECTED');
      expect(result!.status).toBe('REJECTED');
      expect(affiliatesRepo.updateStatus).toHaveBeenCalledWith(
        'aff-123',
        'SUSPENDED',
        'Flagged for fraud review',
      );
      expect(affiliatesRepo.createCommission).not.toHaveBeenCalled();
    });

    it('should allow commission when click rate is below threshold', async () => {
      affiliatesRepo.findById.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.countRecentClicks.mockResolvedValue(50); // Under threshold

      const result = await service.calculateCommission('aff-123', mockConversionEvent);

      expect(result!.rejected).toBe(false);
      expect(affiliatesRepo.createCommission).toHaveBeenCalled();
    });
  });

  describe('requestPayout', () => {
    it('should process payout when balance is above $50 threshold', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.getPendingBalance.mockResolvedValue(7500); // $75.00

      const result = await service.requestPayout('user-456');

      expect(result.status).toBe('PROCESSING');
      expect(result.amount).toBe(7500);
      expect(result.currency).toBe('USD');
      expect(affiliatesRepo.markCommissionsAsPaid).toHaveBeenCalledWith('aff-123');
    });

    it('should throw BELOW_MINIMUM_PAYOUT when balance is under $50', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.getPendingBalance.mockResolvedValue(3000); // $30.00

      await expect(service.requestPayout('user-456'))
        .rejects
        .toThrow(ConflictException);

      try {
        await service.requestPayout('user-456');
      } catch (error: any) {
        const response = error.getResponse();
        expect(response.code).toBe('BELOW_MINIMUM_PAYOUT');
        expect(response.currentBalance).toBe(3000);
        expect(response.minimumRequired).toBe(MIN_PAYOUT_THRESHOLD);
      }
    });

    it('should throw AFFILIATE_NOT_FOUND for non-affiliate user', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);

      await expect(service.requestPayout('user-999'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw AFFILIATE_NOT_ACTIVE for non-active affiliate', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockPendingAffiliate);

      await expect(service.requestPayout('user-456'))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should reject payout at exactly $49.99 (4999 cents)', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.getPendingBalance.mockResolvedValue(4999);

      await expect(service.requestPayout('user-456'))
        .rejects
        .toThrow(ConflictException);
    });

    it('should allow payout at exactly $50.00 (5000 cents)', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);
      affiliatesRepo.getPendingBalance.mockResolvedValue(5000);

      const result = await service.requestPayout('user-456');

      expect(result.status).toBe('PROCESSING');
      expect(result.amount).toBe(5000);
    });
  });

  describe('generateTrackingLink', () => {
    it('should generate tracking link for active affiliate', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);

      const result = await service.generateTrackingLink('user-456', 'game-50');

      expect(result.trackingCode).toBe('abc123def456');
      expect(result.trackingLink).toBe('/r/abc123def456?game=game-50');
      expect(result.gameId).toBe('game-50');
    });

    it('should throw AFFILIATE_NOT_FOUND for non-affiliate user', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);

      await expect(service.generateTrackingLink('user-999', 'game-50'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw AFFILIATE_NOT_ACTIVE for pending affiliate', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockPendingAffiliate);

      await expect(service.generateTrackingLink('user-456', 'game-50'))
        .rejects
        .toThrow(ForbiddenException);
    });
  });

  describe('updateAffiliateStatus', () => {
    it('should update affiliate status successfully', async () => {
      affiliatesRepo.findById.mockResolvedValue(mockPendingAffiliate);
      affiliatesRepo.updateStatus.mockResolvedValue({
        ...mockPendingAffiliate,
        status: 'ACTIVE',
      });

      const result = await service.updateAffiliateStatus('aff-789', {
        status: 'ACTIVE' as any,
        reason: 'Application approved',
      });

      expect(result.previousStatus).toBe('PENDING');
      expect(result.newStatus).toBe('ACTIVE');
      expect(result.reason).toBe('Application approved');
      expect(affiliatesRepo.updateStatus).toHaveBeenCalledWith(
        'aff-789',
        'ACTIVE',
        'Application approved',
      );
    });

    it('should throw AFFILIATE_NOT_FOUND for invalid affiliate ID', async () => {
      affiliatesRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateAffiliateStatus('aff-999', { status: 'ACTIVE' as any }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEarnings', () => {
    it('should return earnings report for affiliate', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);

      const result = await service.getEarnings('user-456', {});

      expect(result.affiliateId).toBe('aff-123');
      expect(result.tier).toBe('BRONZE');
      expect(result.commissionRate).toBe(0.05);
      expect(result.totalEarned).toBe(500);
      expect(result.totalClicks).toBe(100);
    });

    it('should throw AFFILIATE_NOT_FOUND for non-affiliate', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(null);

      await expect(service.getEarnings('user-999', {}))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should pass date range to repository', async () => {
      affiliatesRepo.findByUserId.mockResolvedValue(mockActiveAffiliate);

      await service.getEarnings('user-456', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(affiliatesRepo.getEarningsSummary).toHaveBeenCalledWith(
        'aff-123',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
    });
  });

  describe('checkFraudScore', () => {
    it('should return high score (90) when clicks exceed 100/min', async () => {
      affiliatesRepo.countRecentClicks.mockResolvedValue(150);

      const score = await service.checkFraudScore('aff-123', mockConversionEvent);

      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should return moderate score (40) when clicks are 50-100/min', async () => {
      affiliatesRepo.countRecentClicks.mockResolvedValue(75);

      const score = await service.checkFraudScore('aff-123', mockConversionEvent);

      expect(score).toBe(40);
    });

    it('should return 0 for normal activity', async () => {
      affiliatesRepo.countRecentClicks.mockResolvedValue(10);

      const score = await service.checkFraudScore('aff-123', mockConversionEvent);

      expect(score).toBe(0);
    });

    it('should add 10 for very small conversion amounts', async () => {
      affiliatesRepo.countRecentClicks.mockResolvedValue(10);
      const smallEvent = { ...mockConversionEvent, amount: 50 }; // $0.50

      const score = await service.checkFraudScore('aff-123', smallEvent);

      expect(score).toBe(10);
    });

    it('should cap score at 100', async () => {
      affiliatesRepo.countRecentClicks.mockResolvedValue(200);
      const smallEvent = { ...mockConversionEvent, amount: 50 };

      const score = await service.checkFraudScore('aff-123', smallEvent);

      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
