/**
 * Sessions Service Unit Tests
 *
 * Tests for game session lifecycle management:
 * - Start session: validates user active, game published, concurrent limit
 * - Process action: validates against state, computes new state, auto-end on game-over
 * - End session: persists score, cleans Redis, publishes analytics
 * - Timeout handling: auto-expire inactive sessions
 * - Ownership verification on all operations
 * - Rejection of actions on ended sessions
 *
 * Requirements: 4.1-4.7, 5.1-5.5
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  SessionsService,
  SESSION_CACHE_CLIENT,
  ANALYTICS_PUBLISHER,
  USER_LOOKUP,
  GAME_LOOKUP,
  SessionData,
} from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { GameActionDto } from './dto/game-action.dto';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: any;
  let cacheClient: any;
  let analyticsPublisher: any;
  let userLookup: any;
  let gameLookup: any;

  const mockActiveUser = { id: 'user-123', status: 'ACTIVE' };
  const mockInactiveUser = { id: 'user-456', status: 'SUSPENDED' };
  const mockPublishedGame = {
    id: 'game-001',
    status: 'PUBLISHED',
    config: { sessionTimeout: 3600 },
  };
  const mockUnpublishedGame = {
    id: 'game-002',
    status: 'DRAFT',
    config: { sessionTimeout: 3600 },
  };

  const mockSessionData: SessionData = {
    userId: 'user-123',
    gameId: 'game-001',
    state: { level: 1, lives: 3, score: 0, powerUps: [], customData: {} },
    score: 0,
    startedAt: '2024-01-01T00:00:00.000Z',
    lastActivityAt: '2024-01-01T00:00:00.000Z',
    actions: [],
  };

  beforeEach(async () => {
    sessionsRepository = {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findById: jest.fn(),
      countActiveSessions: jest.fn().mockResolvedValue(0),
      endSession: jest.fn().mockResolvedValue({}),
      createGameResult: jest.fn().mockResolvedValue({}),
      findExpiredSessions: jest.fn().mockResolvedValue([]),
      updateLastActivity: jest.fn().mockResolvedValue({}),
    };

    cacheClient = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    analyticsPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    userLookup = {
      findById: jest.fn().mockResolvedValue(mockActiveUser),
    };

    gameLookup = {
      findById: jest.fn().mockResolvedValue(mockPublishedGame),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: sessionsRepository },
        { provide: SESSION_CACHE_CLIENT, useValue: cacheClient },
        { provide: ANALYTICS_PUBLISHER, useValue: analyticsPublisher },
        { provide: USER_LOOKUP, useValue: userLookup },
        { provide: GAME_LOOKUP, useValue: gameLookup },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  // ===========================================================================
  // Task 7.1: Start Game Session
  // ===========================================================================

  describe('startSession', () => {
    it('should create a new session for an active user and published game', async () => {
      const result = await service.startSession('user-123', 'game-001');

      expect(result).toHaveProperty('sessionId');
      expect(result.gameId).toBe('game-001');
      expect(result.state).toEqual({
        level: 1,
        lives: 3,
        score: 0,
        powerUps: [],
        customData: {},
      });
      expect(result).toHaveProperty('startedAt');
    });

    it('should store session in Redis with game-specific TTL', async () => {
      await service.startSession('user-123', 'game-001');

      expect(cacheClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        3600, // game config sessionTimeout
        expect.any(String),
      );
    });

    it('should persist session to PostgreSQL', async () => {
      await service.startSession('user-123', 'game-001');

      expect(sessionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          gameId: 'game-001',
          state: expect.objectContaining({ level: 1, lives: 3 }),
        }),
      );
    });

    it('should publish game_start analytics event', async () => {
      await service.startSession('user-123', 'game-001');

      expect(analyticsPublisher.publish).toHaveBeenCalledWith(
        'analytics-events',
        expect.objectContaining({
          eventType: 'game_start',
          userId: 'user-123',
          payload: expect.objectContaining({ gameId: 'game-001' }),
        }),
      );
    });

    it('should throw ForbiddenException when user is not active', async () => {
      userLookup.findById.mockResolvedValue(mockInactiveUser);

      await expect(
        service.startSession('user-456', 'game-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user does not exist', async () => {
      userLookup.findById.mockResolvedValue(null);

      await expect(
        service.startSession('nonexistent', 'game-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when game is not published', async () => {
      gameLookup.findById.mockResolvedValue(mockUnpublishedGame);

      await expect(
        service.startSession('user-123', 'game-002'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when game does not exist', async () => {
      gameLookup.findById.mockResolvedValue(null);

      await expect(
        service.startSession('user-123', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when concurrent limit reached (max 3)', async () => {
      sessionsRepository.countActiveSessions.mockResolvedValue(3);

      await expect(
        service.startSession('user-123', 'game-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('should include active sessions info in ConflictException', async () => {
      sessionsRepository.countActiveSessions.mockResolvedValue(3);

      try {
        await service.startSession('user-123', 'game-001');
        fail('Expected ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse();
        expect(response).toHaveProperty('message', 'Maximum concurrent sessions reached');
        expect(response).toHaveProperty('activeSessions', 3);
        expect(response).toHaveProperty('limit', 3);
      }
    });

    it('should allow up to 2 concurrent sessions', async () => {
      sessionsRepository.countActiveSessions.mockResolvedValue(2);

      const result = await service.startSession('user-123', 'game-001');

      expect(result).toHaveProperty('sessionId');
    });

    it('should use default timeout when game config has no sessionTimeout', async () => {
      gameLookup.findById.mockResolvedValue({
        id: 'game-003',
        status: 'PUBLISHED',
        config: {},
      });

      await service.startSession('user-123', 'game-003');

      expect(cacheClient.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^session:/),
        3600, // default timeout
        expect.any(String),
      );
    });
  });

  // ===========================================================================
  // Task 7.2: Process Game Action
  // ===========================================================================

  describe('processAction', () => {
    beforeEach(() => {
      cacheClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
    });

    it('should process a valid action and return updated state', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 3, y: 5 },
      };

      const result: any = await service.processAction('session-1', action, 'user-123');

      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('actionsCount');
      expect(result.gameOver).toBe(false);
    });

    it('should compute new state deterministically (same state + action = same result)', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 1, y: 1 },
      };

      // First call
      const result1: any = await service.processAction('session-1', action, 'user-123');

      // Reset the cache to the same initial state
      cacheClient.get.mockResolvedValue(JSON.stringify(mockSessionData));

      // Second call with same input
      const result2: any = await service.processAction('session-1', action, 'user-123');

      // Results should be identical (deterministic)
      expect(result1.state).toEqual(result2.state);
      expect(result1.score).toEqual(result2.score);
    });

    it('should increment score on move/swap/place/rotate actions', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 3, y: 5 },
      };

      const result: any = await service.processAction('session-1', action, 'user-123');

      expect(result.score).toBe(10);
    });

    it('should handle submit action with correct answer (score +50)', async () => {
      const action: GameActionDto = {
        actionType: 'submit',
        payload: { correct: true, answer: 'A' },
      };

      const result: any = await service.processAction('session-1', action, 'user-123');

      expect(result.score).toBe(50);
    });

    it('should handle submit action with incorrect answer (lose a life)', async () => {
      const action: GameActionDto = {
        actionType: 'submit',
        payload: { correct: false, answer: 'B' },
      };

      const result: any = await service.processAction('session-1', action, 'user-123');

      expect(result.state.lives).toBe(2);
    });

    it('should auto-end session on game-over (lives <= 0)', async () => {
      // Set state with 1 life remaining
      const oneLifeSession: SessionData = {
        ...mockSessionData,
        state: { ...mockSessionData.state, lives: 1 },
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(oneLifeSession));

      const action: GameActionDto = {
        actionType: 'submit',
        payload: { correct: false, answer: 'wrong' },
      };

      const result = await service.processAction('session-1', action, 'user-123');

      // Should return end-session result
      expect(result.gameOver).toBe(true);
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('duration');
    });

    it('should reject action if session not found', async () => {
      cacheClient.get.mockResolvedValue(null);

      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 1, y: 1 },
      };

      await expect(
        service.processAction('nonexistent', action, 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject action if user does not own the session', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 1, y: 1 },
      };

      await expect(
        service.processAction('session-1', action, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject action on ended session (Req 5.5)', async () => {
      const endedSession: SessionData = {
        ...mockSessionData,
        endedAt: '2024-01-01T01:00:00.000Z',
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(endedSession));

      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 1, y: 1 },
      };

      await expect(
        service.processAction('session-1', action, 'user-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject invalid action type with BadRequestException', async () => {
      const action: GameActionDto = {
        actionType: 'invalid_action',
        payload: { foo: 'bar' },
      };

      await expect(
        service.processAction('session-1', action, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject action with empty payload', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: {},
      };

      await expect(
        service.processAction('session-1', action, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject action when game is already over (no lives)', async () => {
      const gameOverSession: SessionData = {
        ...mockSessionData,
        state: { ...mockSessionData.state, lives: 0 },
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(gameOverSession));

      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 1, y: 1 },
      };

      await expect(
        service.processAction('session-1', action, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save updated session state to Redis', async () => {
      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 3, y: 5 },
      };

      await service.processAction('session-1', action, 'user-123');

      expect(cacheClient.setex).toHaveBeenCalledWith(
        'session:session-1',
        3600,
        expect.any(String),
      );

      // Verify the saved state contains the action
      const savedData = JSON.parse(cacheClient.setex.mock.calls[0][2]);
      expect(savedData.actions).toHaveLength(1);
      expect(savedData.actions[0].actionType).toBe('move');
    });

    it('should track action count correctly', async () => {
      const sessionWith2Actions: SessionData = {
        ...mockSessionData,
        actions: [
          { actionType: 'move', payload: { x: 1, y: 1 }, timestamp: '2024-01-01T00:01:00Z', resultingScore: 10 },
          { actionType: 'move', payload: { x: 2, y: 2 }, timestamp: '2024-01-01T00:02:00Z', resultingScore: 20 },
        ],
        score: 20,
        state: { ...mockSessionData.state, score: 20 },
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(sessionWith2Actions));

      const action: GameActionDto = {
        actionType: 'move',
        payload: { x: 3, y: 3 },
      };

      const result: any = await service.processAction('session-1', action, 'user-123');

      expect(result.actionsCount).toBe(3);
    });
  });

  // ===========================================================================
  // Task 7.5: End Session and Timeout Handling
  // ===========================================================================

  describe('endSession', () => {
    beforeEach(() => {
      cacheClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
    });

    it('should end session and return final results', async () => {
      const result = await service.endSession('session-1', 'user-123');

      expect(result.sessionId).toBe('session-1');
      expect(result).toHaveProperty('finalScore');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('actionsCount');
      expect(result.gameOver).toBe(true);
    });

    it('should persist final score and state to PostgreSQL', async () => {
      await service.endSession('session-1', 'user-123');

      expect(sessionsRepository.endSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          score: 0,
          endedAt: expect.any(Date),
          duration: expect.any(Number),
          state: mockSessionData.state,
          actions: [],
        }),
      );
    });

    it('should create a game result record for leaderboards', async () => {
      await service.endSession('session-1', 'user-123');

      expect(sessionsRepository.createGameResult).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          gameId: 'game-001',
          sessionId: 'session-1',
          score: 0,
          duration: expect.any(Number),
        }),
      );
    });

    it('should clean up Redis session data', async () => {
      await service.endSession('session-1', 'user-123');

      expect(cacheClient.del).toHaveBeenCalledWith('session:session-1');
    });

    it('should publish game_end analytics event', async () => {
      await service.endSession('session-1', 'user-123');

      expect(analyticsPublisher.publish).toHaveBeenCalledWith(
        'analytics-events',
        expect.objectContaining({
          eventType: 'game_end',
          userId: 'user-123',
          payload: expect.objectContaining({
            gameId: 'game-001',
            sessionId: 'session-1',
            score: 0,
          }),
        }),
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      cacheClient.get.mockResolvedValue(null);

      await expect(
        service.endSession('nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own session', async () => {
      await expect(
        service.endSession('session-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when session already ended', async () => {
      const endedSession: SessionData = {
        ...mockSessionData,
        endedAt: '2024-01-01T01:00:00.000Z',
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(endedSession));

      await expect(
        service.endSession('session-1', 'user-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should calculate duration correctly', async () => {
      // Session started 30 minutes ago
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const sessionData: SessionData = {
        ...mockSessionData,
        startedAt: thirtyMinAgo,
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await service.endSession('session-1', 'user-123');

      // Duration should be approximately 30 minutes (1800 seconds)
      expect(result.duration).toBeGreaterThanOrEqual(1799);
      expect(result.duration).toBeLessThanOrEqual(1801);
    });
  });

  describe('expireInactiveSessions', () => {
    it('should expire sessions that exceeded timeout', async () => {
      const expiredSession = {
        id: 'expired-session-1',
        userId: 'user-123',
        gameId: 'game-001',
        score: 50,
        state: { level: 2, lives: 2, score: 50, powerUps: [], customData: {} },
        startedAt: new Date(Date.now() - 7200000), // 2 hours ago
        lastActivityAt: new Date(Date.now() - 7200000),
        endedAt: null,
      };
      sessionsRepository.findExpiredSessions.mockResolvedValue([expiredSession]);
      cacheClient.get.mockResolvedValue(null); // Redis TTL already expired

      const count = await service.expireInactiveSessions(3600000); // 1 hour timeout

      expect(count).toBe(1);
      expect(sessionsRepository.endSession).toHaveBeenCalledWith(
        'expired-session-1',
        expect.objectContaining({
          score: 50,
          endedAt: expect.any(Date),
        }),
      );
    });

    it('should create game result for expired sessions', async () => {
      const expiredSession = {
        id: 'expired-session-1',
        userId: 'user-123',
        gameId: 'game-001',
        score: 75,
        state: { level: 3, lives: 1, score: 75, powerUps: [], customData: {} },
        startedAt: new Date(Date.now() - 7200000),
        lastActivityAt: new Date(Date.now() - 7200000),
        endedAt: null,
      };
      sessionsRepository.findExpiredSessions.mockResolvedValue([expiredSession]);
      cacheClient.get.mockResolvedValue(null);

      await service.expireInactiveSessions(3600000);

      expect(sessionsRepository.createGameResult).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          gameId: 'game-001',
          sessionId: 'expired-session-1',
          score: 75,
        }),
      );
    });

    it('should publish game_timeout analytics event for expired sessions', async () => {
      const expiredSession = {
        id: 'expired-session-1',
        userId: 'user-123',
        gameId: 'game-001',
        score: 30,
        state: { level: 1, lives: 3, score: 30, powerUps: [], customData: {} },
        startedAt: new Date(Date.now() - 7200000),
        lastActivityAt: new Date(Date.now() - 7200000),
        endedAt: null,
      };
      sessionsRepository.findExpiredSessions.mockResolvedValue([expiredSession]);

      await service.expireInactiveSessions(3600000);

      expect(analyticsPublisher.publish).toHaveBeenCalledWith(
        'analytics-events',
        expect.objectContaining({
          eventType: 'game_timeout',
          userId: 'user-123',
          payload: expect.objectContaining({
            reason: 'inactivity_timeout',
          }),
        }),
      );
    });

    it('should use Redis state if still available', async () => {
      const expiredSession = {
        id: 'expired-session-1',
        userId: 'user-123',
        gameId: 'game-001',
        score: 30,
        state: { level: 1, lives: 3, score: 30, powerUps: [], customData: {} },
        startedAt: new Date(Date.now() - 7200000),
        lastActivityAt: new Date(Date.now() - 7200000),
        endedAt: null,
      };
      sessionsRepository.findExpiredSessions.mockResolvedValue([expiredSession]);

      // Redis still has session (not yet TTL expired)
      const redisSession: SessionData = {
        userId: 'user-123',
        gameId: 'game-001',
        state: { level: 3, lives: 1, score: 150, powerUps: ['shield'], customData: {} },
        score: 150,
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        lastActivityAt: new Date(Date.now() - 3700000).toISOString(),
        actions: [{ actionType: 'move', payload: { x: 1, y: 1 }, timestamp: '', resultingScore: 10 }],
      };
      cacheClient.get.mockResolvedValue(JSON.stringify(redisSession));

      await service.expireInactiveSessions(3600000);

      // Should use the Redis score (150) instead of DB score (30)
      expect(sessionsRepository.endSession).toHaveBeenCalledWith(
        'expired-session-1',
        expect.objectContaining({
          score: 150,
        }),
      );
    });

    it('should return 0 when no sessions are expired', async () => {
      sessionsRepository.findExpiredSessions.mockResolvedValue([]);

      const count = await service.expireInactiveSessions(3600000);

      expect(count).toBe(0);
    });

    it('should continue processing remaining sessions if one fails', async () => {
      const sessions = [
        {
          id: 'fail-session',
          userId: 'user-1',
          gameId: 'game-001',
          score: 10,
          state: {},
          startedAt: new Date(Date.now() - 7200000),
          lastActivityAt: new Date(Date.now() - 7200000),
          endedAt: null,
        },
        {
          id: 'success-session',
          userId: 'user-2',
          gameId: 'game-001',
          score: 20,
          state: {},
          startedAt: new Date(Date.now() - 7200000),
          lastActivityAt: new Date(Date.now() - 7200000),
          endedAt: null,
        },
      ];
      sessionsRepository.findExpiredSessions.mockResolvedValue(sessions);

      // First session endSession fails
      sessionsRepository.endSession
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({});

      const count = await service.expireInactiveSessions(3600000);

      // Only the second one should succeed
      expect(count).toBe(1);
    });
  });
});
