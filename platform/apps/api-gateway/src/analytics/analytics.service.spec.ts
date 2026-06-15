/**
 * Unit Tests: AnalyticsService
 *
 * Tests event tracking, metric calculations, date validation,
 * and the net revenue = gross - refunds consistency property.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsRepo: jest.Mocked<AnalyticsRepository>;

  beforeEach(() => {
    analyticsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'event-1', eventType: 'game_start' }),
      countSessions: jest.fn().mockResolvedValue(100),
      sumPlayTime: jest.fn().mockResolvedValue(7200),
      getDailyActiveUsers: jest.fn().mockResolvedValue(50),
      getRetentionRates: jest.fn().mockResolvedValue({ day1: 60, day7: 30, day30: 15 }),
      getGamePerformance: jest.fn().mockResolvedValue([
        {
          gameId: 'game-1',
          title: 'Chess',
          playCount: 200,
          avgDuration: 300,
          completionRate: 85,
          revenue: 5000,
        },
      ]),
      getGrossRevenue: jest.fn().mockResolvedValue(10000),
      getRefunds: jest.fn().mockResolvedValue(1500),
      getAdRevenue: jest.fn().mockResolvedValue(3000),
    } as any;

    service = new AnalyticsService(analyticsRepo);
  });

  // =========================================================================
  // trackEvent (Requirement 15.1)
  // =========================================================================

  describe('trackEvent', () => {
    it('should track a valid game_start event', async () => {
      const result = await service.trackEvent({
        userId: 'user-1',
        eventType: 'game_start',
        payload: { gameId: 'game-1' },
      });

      expect(result).toEqual({ tracked: true });
      expect(analyticsRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        eventType: 'game_start',
        payload: { gameId: 'game-1' },
      });
    });

    it('should track a valid game_end event', async () => {
      const result = await service.trackEvent({
        eventType: 'game_end',
        payload: { gameId: 'game-1', duration: 120, score: 500 },
      });

      expect(result).toEqual({ tracked: true });
      expect(analyticsRepo.create).toHaveBeenCalledWith({
        userId: undefined,
        eventType: 'game_end',
        payload: { gameId: 'game-1', duration: 120, score: 500 },
      });
    });

    it('should track a valid purchase event', async () => {
      const result = await service.trackEvent({
        userId: 'user-1',
        eventType: 'purchase',
        payload: { amount: 999, itemId: 'item-1' },
      });

      expect(result).toEqual({ tracked: true });
    });

    it('should track a valid page_view event', async () => {
      const result = await service.trackEvent({
        eventType: 'page_view',
        payload: { path: '/games/chess' },
      });

      expect(result).toEqual({ tracked: true });
    });

    it('should track a valid ad_impression event', async () => {
      const result = await service.trackEvent({
        eventType: 'ad_impression',
        payload: { adUnitId: 'ad-1', revenue: 0.02 },
      });

      expect(result).toEqual({ tracked: true });
    });

    it('should track a valid ad_click event', async () => {
      const result = await service.trackEvent({
        eventType: 'ad_click',
        payload: { adUnitId: 'ad-1', revenue: 0.15 },
      });

      expect(result).toEqual({ tracked: true });
    });

    it('should reject an invalid event type', async () => {
      await expect(
        service.trackEvent({
          eventType: 'invalid_event',
          payload: {},
        }),
      ).rejects.toThrow(BadRequestException);

      expect(analyticsRepo.create).not.toHaveBeenCalled();
    });

    it('should track event without userId (anonymous)', async () => {
      const result = await service.trackEvent({
        eventType: 'page_view',
        payload: { path: '/' },
      });

      expect(result).toEqual({ tracked: true });
      expect(analyticsRepo.create).toHaveBeenCalledWith({
        userId: undefined,
        eventType: 'page_view',
        payload: { path: '/' },
      });
    });

    it('should track event without payload', async () => {
      const result = await service.trackEvent({
        userId: 'user-1',
        eventType: 'user_login',
      });

      expect(result).toEqual({ tracked: true });
      expect(analyticsRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        eventType: 'user_login',
        payload: undefined,
      });
    });
  });

  // =========================================================================
  // getUserMetrics (Requirement 15.2)
  // =========================================================================

  describe('getUserMetrics', () => {
    const validQuery = { startDate: '2024-01-01', endDate: '2024-01-31' };

    it('should return user engagement metrics for valid date range', async () => {
      const result = await service.getUserMetrics(validQuery);

      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        totalSessions: 100,
        totalPlayTimeMinutes: 120, // 7200 seconds / 60
        dailyActiveUsers: 50,
        retention: { day1: 60, day7: 30, day30: 15 },
      });
    });

    it('should call repository with correct date range', async () => {
      await service.getUserMetrics(validQuery);

      expect(analyticsRepo.countSessions).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      expect(analyticsRepo.sumPlayTime).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      expect(analyticsRepo.getDailyActiveUsers).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      expect(analyticsRepo.getRetentionRates).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
    });

    it('should round play time to nearest minute', async () => {
      analyticsRepo.sumPlayTime.mockResolvedValue(125); // 2.08 minutes

      const result = await service.getUserMetrics(validQuery);
      expect(result.totalPlayTimeMinutes).toBe(2);
    });
  });

  // =========================================================================
  // getGameMetrics (Requirement 15.3)
  // =========================================================================

  describe('getGameMetrics', () => {
    const validQuery = { startDate: '2024-01-01', endDate: '2024-01-31' };

    it('should return game performance metrics', async () => {
      const result = await service.getGameMetrics(validQuery);

      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        games: [
          {
            gameId: 'game-1',
            title: 'Chess',
            totalPlays: 200,
            avgSessionDuration: 300,
            completionRate: 85,
            revenue: 5000,
          },
        ],
      });
    });

    it('should handle empty game performance list', async () => {
      analyticsRepo.getGamePerformance.mockResolvedValue([]);

      const result = await service.getGameMetrics(validQuery);
      expect(result.games).toEqual([]);
    });
  });

  // =========================================================================
  // getRevenueMetrics (Requirement 15.4)
  // =========================================================================

  describe('getRevenueMetrics', () => {
    const validQuery = { startDate: '2024-01-01', endDate: '2024-01-31' };

    it('should return revenue metrics with correct calculations', async () => {
      const result = await service.getRevenueMetrics(validQuery);

      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        grossRevenue: 10000,
        refunds: 1500,
        netRevenue: 8500, // 10000 - 1500
        adRevenue: 3000,
        totalRevenue: 11500, // 8500 + 3000
        bySource: {
          inAppPurchases: 8500, // gross - refunds
          advertising: 3000,
          subscriptions: 0,
        },
      });
    });

    it('should maintain net revenue = gross - refunds consistency', async () => {
      analyticsRepo.getGrossRevenue.mockResolvedValue(5000);
      analyticsRepo.getRefunds.mockResolvedValue(2000);
      analyticsRepo.getAdRevenue.mockResolvedValue(1000);

      const result = await service.getRevenueMetrics(validQuery);

      expect(result.netRevenue).toBe(result.grossRevenue - result.refunds);
      expect(result.netRevenue).toBe(3000);
      expect(result.bySource.inAppPurchases).toBe(result.netRevenue);
    });

    it('should handle zero revenue', async () => {
      analyticsRepo.getGrossRevenue.mockResolvedValue(0);
      analyticsRepo.getRefunds.mockResolvedValue(0);
      analyticsRepo.getAdRevenue.mockResolvedValue(0);

      const result = await service.getRevenueMetrics(validQuery);

      expect(result.netRevenue).toBe(0);
      expect(result.totalRevenue).toBe(0);
    });

    it('should handle case where refunds equal gross revenue', async () => {
      analyticsRepo.getGrossRevenue.mockResolvedValue(5000);
      analyticsRepo.getRefunds.mockResolvedValue(5000);
      analyticsRepo.getAdRevenue.mockResolvedValue(1000);

      const result = await service.getRevenueMetrics(validQuery);

      expect(result.netRevenue).toBe(0);
      expect(result.totalRevenue).toBe(1000);
      expect(result.bySource.inAppPurchases).toBe(0);
    });
  });

  // =========================================================================
  // validateDateRange
  // =========================================================================

  describe('validateDateRange', () => {
    it('should accept a valid date range', () => {
      expect(() =>
        service.validateDateRange({ startDate: '2024-01-01', endDate: '2024-01-31' }),
      ).not.toThrow();
    });

    it('should reject date range exceeding 365 days', () => {
      expect(() =>
        service.validateDateRange({ startDate: '2023-01-01', endDate: '2024-06-01' }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateDateRange({ startDate: '2023-01-01', endDate: '2024-06-01' }),
      ).toThrow('Date range cannot exceed 365 days');
    });

    it('should reject start date after end date', () => {
      expect(() =>
        service.validateDateRange({ startDate: '2024-06-01', endDate: '2024-01-01' }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateDateRange({ startDate: '2024-06-01', endDate: '2024-01-01' }),
      ).toThrow('Start date must be before end date');
    });

    it('should reject start date in the future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureStr = futureDate.toISOString().split('T')[0];
      const endStr = new Date(futureDate.getTime() + 86400000).toISOString().split('T')[0];

      expect(() =>
        service.validateDateRange({ startDate: futureStr, endDate: endStr }),
      ).toThrow(BadRequestException);
    });

    it('should accept range of exactly 365 days', () => {
      expect(() =>
        service.validateDateRange({ startDate: '2023-01-01', endDate: '2024-01-01' }),
      ).not.toThrow();
    });

    it('should reject invalid start date format', () => {
      expect(() =>
        service.validateDateRange({ startDate: 'not-a-date', endDate: '2024-01-31' }),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid end date format', () => {
      expect(() =>
        service.validateDateRange({ startDate: '2024-01-01', endDate: 'invalid' }),
      ).toThrow(BadRequestException);
    });
  });
});
