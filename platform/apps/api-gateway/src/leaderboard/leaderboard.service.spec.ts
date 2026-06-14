/**
 * Leaderboard Service — Unit Tests
 *
 * Tests covering:
 * 1. Ranking logic: scores sorted descending
 * 2. Tie-breaking: same scores sorted by earliest timestamp
 * 3. Sequential ranks 1..N assigned correctly
 * 4. Redis caching: cache hit returns cached data
 * 5. Redis caching: miss triggers DB query and caches result
 * 6. Period filtering: daily, weekly, monthly, all-time
 * 7. Limit parameter respected (entries ≤ limit)
 * 8. Cache errors don't crash the service (graceful degradation)
 * 9. Empty leaderboard returns empty entries array
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 19.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardRepository } from './leaderboard.repository';
import { REDIS_CLIENT } from '../common/guards/rate-limit.guard';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let repository: jest.Mocked<LeaderboardRepository>;
  let redisClient: any;

  const mockRepository = {
    getTopScores: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: LeaderboardRepository, useValue: mockRepository },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    repository = module.get(LeaderboardRepository) as jest.Mocked<LeaderboardRepository>;
    redisClient = module.get(REDIS_CLIENT);
  });

  // =========================================================================
  // Test 1: Scores sorted descending by score
  // =========================================================================
  it('should return entries sorted descending by score (Requirement 6.1)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 1000, completedAt: new Date('2024-01-01'), user: { username: 'alice', profile: null } },
      { userId: 'u2', score: 800, completedAt: new Date('2024-01-02'), user: { username: 'bob', profile: null } },
      { userId: 'u3', score: 500, completedAt: new Date('2024-01-03'), user: { username: 'charlie', profile: null } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    expect(result.entries[0].score).toBe(1000);
    expect(result.entries[1].score).toBe(800);
    expect(result.entries[2].score).toBe(500);
  });

  // =========================================================================
  // Test 2: Tie-breaking by earliest timestamp (Requirement 6.2)
  // =========================================================================
  it('should break ties by earliest achievement timestamp (Requirement 6.2)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    // Repository returns already sorted by score DESC, completedAt ASC
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 1000, completedAt: new Date('2024-01-01T10:00:00Z'), user: { username: 'alice', profile: null } },
      { userId: 'u2', score: 1000, completedAt: new Date('2024-01-01T12:00:00Z'), user: { username: 'bob', profile: null } },
      { userId: 'u3', score: 1000, completedAt: new Date('2024-01-01T14:00:00Z'), user: { username: 'charlie', profile: null } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    // Alice achieved score first, so she ranks #1
    expect(result.entries[0].username).toBe('alice');
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].username).toBe('bob');
    expect(result.entries[1].rank).toBe(2);
    expect(result.entries[2].username).toBe('charlie');
    expect(result.entries[2].rank).toBe(3);
  });

  // =========================================================================
  // Test 3: Sequential ranks 1..N assigned (Requirement 6.4)
  // =========================================================================
  it('should assign unique sequential ranks from 1 to N (Requirement 6.4)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 500, completedAt: new Date('2024-01-01'), user: { username: 'a', profile: null } },
      { userId: 'u2', score: 400, completedAt: new Date('2024-01-02'), user: { username: 'b', profile: null } },
      { userId: 'u3', score: 300, completedAt: new Date('2024-01-03'), user: { username: 'c', profile: null } },
      { userId: 'u4', score: 200, completedAt: new Date('2024-01-04'), user: { username: 'd', profile: null } },
      { userId: 'u5', score: 100, completedAt: new Date('2024-01-05'), user: { username: 'e', profile: null } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    result.entries.forEach((entry, idx) => {
      expect(entry.rank).toBe(idx + 1);
    });
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[4].rank).toBe(5);
  });

  // =========================================================================
  // Test 4: Redis cache hit returns cached data (Requirement 19.5)
  // =========================================================================
  it('should return cached data on cache hit (Requirement 19.5)', async () => {
    const cachedResponse = {
      gameId: 'game-1',
      period: 'all-time',
      entries: [{ rank: 1, userId: 'u1', username: 'cached-user', displayName: 'Cached', avatarUrl: null, score: 999, achievedAt: '2024-01-01T00:00:00.000Z' }],
      total: 1,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    expect(result).toEqual(cachedResponse);
    // Repository should NOT be called when cache hits
    expect(mockRepository.getTopScores).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 5: Cache miss triggers DB query and caches result
  // =========================================================================
  it('should query DB on cache miss and cache the result with 30s TTL', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 100, completedAt: new Date('2024-01-01'), user: { username: 'player1', profile: { displayName: 'Player One', avatarUrl: 'http://img.com/1.png' } } },
    ]);

    await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    // Verify DB was queried
    expect(mockRepository.getTopScores).toHaveBeenCalledTimes(1);
    // Verify cache was set with 30-second TTL
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'cache:leaderboard:game-1:all-time:50',
      30,
      expect.any(String),
    );
  });

  // =========================================================================
  // Test 6: Period filtering generates correct date boundaries
  // =========================================================================
  describe('period date filtering', () => {
    it('should return null date filter for all-time period', () => {
      const dateFilter = service.getDateFilter('all-time');
      expect(dateFilter).toBeNull();
    });

    it('should return start of today for daily period', () => {
      const dateFilter = service.getDateFilter('daily');
      expect(dateFilter).not.toBeNull();
      const now = new Date();
      const expected = new Date(now);
      expected.setUTCHours(0, 0, 0, 0);
      expect(dateFilter!.getTime()).toBe(expected.getTime());
    });

    it('should return 7 days ago for weekly period', () => {
      const before = new Date();
      const dateFilter = service.getDateFilter('weekly');
      const after = new Date();
      expect(dateFilter).not.toBeNull();
      // Should be approximately 7 days ago
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(dateFilter!.getTime()).toBeGreaterThanOrEqual(before.getTime() - sevenDaysMs - 1000);
      expect(dateFilter!.getTime()).toBeLessThanOrEqual(after.getTime() - sevenDaysMs + 1000);
    });

    it('should return ~30 days ago for monthly period', () => {
      const dateFilter = service.getDateFilter('monthly');
      expect(dateFilter).not.toBeNull();
      const now = new Date();
      // Monthly goes back approximately one month
      const diffDays = (now.getTime() - dateFilter!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(28);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  // =========================================================================
  // Test 7: Limit parameter passed correctly to repository
  // =========================================================================
  it('should pass limit to the repository (Requirement 6.3)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([]);

    await service.getLeaderboard('game-1', { period: 'all-time', limit: 100 });

    expect(mockRepository.getTopScores).toHaveBeenCalledWith(
      { gameId: 'game-1' },
      100,
    );
  });

  // =========================================================================
  // Test 8: Cache errors don't crash the service
  // =========================================================================
  it('should gracefully handle Redis cache errors and still return data', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));
    mockRedis.setex.mockRejectedValue(new Error('Redis connection refused'));
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 50, completedAt: new Date('2024-01-01'), user: { username: 'player', profile: null } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    // Service should still return data despite cache errors
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].score).toBe(50);
  });

  // =========================================================================
  // Test 9: Empty leaderboard returns empty entries
  // =========================================================================
  it('should return empty entries for a game with no results', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([]);

    const result = await service.getLeaderboard('game-with-no-scores', { period: 'all-time', limit: 50 });

    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.gameId).toBe('game-with-no-scores');
    expect(result.period).toBe('all-time');
  });

  // =========================================================================
  // Test 10: Display name falls back to username when profile is null
  // =========================================================================
  it('should use username as displayName when profile is missing', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 100, completedAt: new Date('2024-01-01'), user: { username: 'fallback-user', profile: null } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    expect(result.entries[0].displayName).toBe('fallback-user');
    expect(result.entries[0].username).toBe('fallback-user');
  });

  // =========================================================================
  // Test 11: Display name uses profile displayName when available
  // =========================================================================
  it('should use profile displayName when available', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([
      { userId: 'u1', score: 100, completedAt: new Date('2024-01-01'), user: { username: 'user1', profile: { displayName: 'Cool Player', avatarUrl: 'http://avatar.png' } } },
    ]);

    const result = await service.getLeaderboard('game-1', { period: 'all-time', limit: 50 });

    expect(result.entries[0].displayName).toBe('Cool Player');
    expect(result.entries[0].avatarUrl).toBe('http://avatar.png');
  });

  // =========================================================================
  // Test 12: Date filter applied for daily period queries
  // =========================================================================
  it('should pass completedAt filter for daily period', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRepository.getTopScores.mockResolvedValue([]);

    await service.getLeaderboard('game-1', { period: 'daily', limit: 50 });

    const callArgs = mockRepository.getTopScores.mock.calls[0];
    expect(callArgs[0]).toHaveProperty('completedAt');
    expect(callArgs[0].completedAt).toHaveProperty('gte');
  });
});
