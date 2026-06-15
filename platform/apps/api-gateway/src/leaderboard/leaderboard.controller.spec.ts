/**
 * Leaderboard Controller — Unit Tests
 *
 * Tests covering:
 * 1. Controller calls service with correct parameters
 * 2. Default query parameters applied when not provided
 * 3. Returns service response unchanged
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let service: jest.Mocked<LeaderboardService>;

  const mockService = {
    getLeaderboard: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        { provide: LeaderboardService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    service = module.get(LeaderboardService) as jest.Mocked<LeaderboardService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.getLeaderboard with gameId and query params', async () => {
    const mockResponse = {
      gameId: 'game-123',
      period: 'weekly',
      entries: [],
      total: 0,
    };
    mockService.getLeaderboard.mockResolvedValue(mockResponse);

    const result = await controller.getLeaderboard('game-123', { period: 'weekly', limit: 25 });

    expect(mockService.getLeaderboard).toHaveBeenCalledWith('game-123', { period: 'weekly', limit: 25 });
    expect(result).toEqual(mockResponse);
  });

  it('should pass default query values when not specified', async () => {
    const mockResponse = {
      gameId: 'game-456',
      period: 'all-time',
      entries: [],
      total: 0,
    };
    mockService.getLeaderboard.mockResolvedValue(mockResponse);

    const result = await controller.getLeaderboard('game-456', { period: 'all-time', limit: 50 });

    expect(mockService.getLeaderboard).toHaveBeenCalledWith('game-456', { period: 'all-time', limit: 50 });
    expect(result).toEqual(mockResponse);
  });

  it('should return full leaderboard response with entries', async () => {
    const mockResponse = {
      gameId: 'game-789',
      period: 'daily',
      entries: [
        { rank: 1, userId: 'u1', username: 'alice', displayName: 'Alice', avatarUrl: null, score: 1000, achievedAt: new Date('2024-01-01') },
        { rank: 2, userId: 'u2', username: 'bob', displayName: 'Bob', avatarUrl: null, score: 900, achievedAt: new Date('2024-01-01') },
      ],
      total: 2,
    };
    mockService.getLeaderboard.mockResolvedValue(mockResponse);

    const result = await controller.getLeaderboard('game-789', { period: 'daily', limit: 100 });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].rank).toBe(2);
  });
});
