/**
 * Sessions Service
 *
 * Business logic for game session lifecycle management:
 * - Start session: validate user active, game published, concurrent limit
 * - Process action: validate against state, compute new state deterministically, auto-end on game-over
 * - End session: persist final score, clean Redis, publish analytics events
 * - Timeout handling: auto-expire inactive sessions
 *
 * Sessions are stored in Redis for fast game state access during play,
 * and persisted to PostgreSQL when the session ends.
 *
 * Requirements: 4.1-4.7, 5.1-5.5
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SessionsRepository } from './sessions.repository';
import { GameActionDto } from './dto/game-action.dto';
import * as crypto from 'crypto';

/**
 * Interface for the Redis cache client used for session state.
 */
export interface SessionCacheClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<any>;
  del(key: string): Promise<number>;
}

export const SESSION_CACHE_CLIENT = 'SESSION_CACHE_CLIENT';

/**
 * Interface for the analytics event publisher.
 */
export interface AnalyticsPublisher {
  publish(queue: string, event: any): Promise<void>;
}

export const ANALYTICS_PUBLISHER = 'ANALYTICS_PUBLISHER';

/**
 * Interface for user data lookup (minimal subset needed).
 */
export interface UserLookup {
  findById(userId: string): Promise<{ id: string; status: string } | null>;
}

export const USER_LOOKUP = 'USER_LOOKUP';

/**
 * Interface for game data lookup (minimal subset needed).
 */
export interface GameLookup {
  findById(gameId: string): Promise<{
    id: string;
    status: string;
    config: { sessionTimeout?: number };
  } | null>;
}

export const GAME_LOOKUP = 'GAME_LOOKUP';

/** Maximum concurrent sessions per user */
const MAX_CONCURRENT_SESSIONS = 3;

/** Default session timeout in seconds (1 hour) */
const DEFAULT_SESSION_TIMEOUT = 3600;

/**
 * Session data stored in Redis during active gameplay.
 */
export interface SessionData {
  userId: string;
  gameId: string;
  state: GameState;
  score: number;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
  actions: SessionAction[];
}

export interface GameState {
  level: number;
  lives: number;
  score: number;
  powerUps: string[];
  customData: Record<string, any>;
}

export interface SessionAction {
  actionType: string;
  payload: Record<string, any>;
  timestamp: string;
  resultingScore: number;
}

/**
 * Build the Redis key for a session.
 */
function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    @Inject(SESSION_CACHE_CLIENT) private readonly cacheClient: SessionCacheClient,
    @Inject(ANALYTICS_PUBLISHER) private readonly analyticsPublisher: AnalyticsPublisher,
    @Inject(USER_LOOKUP) private readonly userLookup: UserLookup,
    @Inject(GAME_LOOKUP) private readonly gameLookup: GameLookup,
  ) {}

  /**
   * Start a new game session.
   *
   * Validates:
   * 1. User is active
   * 2. Game is published
   * 3. Concurrent session limit not exceeded (max 3)
   *
   * Creates session state in Redis with game-specific TTL,
   * persists session metadata to PostgreSQL, and publishes analytics event.
   *
   * Requirements: 4.1, 4.2
   */
  async startSession(userId: string, gameId: string) {
    // 1. Validate user is active
    const user = await this.userLookup.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('User account is not active');
    }

    // 2. Validate game is published
    const game = await this.gameLookup.findById(gameId);
    if (!game || game.status !== 'PUBLISHED') {
      throw new NotFoundException('Game not found or not available');
    }

    // 3. Check concurrent session limit
    const activeSessions = await this.sessionsRepository.countActiveSessions(userId);
    if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
      throw new ConflictException({
        message: 'Maximum concurrent sessions reached',
        activeSessions,
        limit: MAX_CONCURRENT_SESSIONS,
      });
    }

    // 4. Create session with initial state
    const sessionId = crypto.randomUUID();
    const initialState: GameState = {
      level: 1,
      lives: 3,
      score: 0,
      powerUps: [],
      customData: {},
    };

    const now = new Date().toISOString();
    const sessionData: SessionData = {
      userId,
      gameId,
      state: initialState,
      score: 0,
      startedAt: now,
      lastActivityAt: now,
      actions: [],
    };

    // Store in Redis with game-specific TTL
    const sessionTimeout = game.config?.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    await this.cacheClient.setex(
      sessionKey(sessionId),
      sessionTimeout,
      JSON.stringify(sessionData),
    );

    // 5. Track in PostgreSQL
    await this.sessionsRepository.create({
      id: sessionId,
      userId,
      gameId,
      state: initialState,
    });

    // 6. Publish analytics event
    await this.analyticsPublisher.publish('analytics-events', {
      eventType: 'game_start',
      userId,
      timestamp: now,
      payload: { gameId, sessionId },
    });

    return {
      sessionId,
      gameId,
      state: initialState,
      startedAt: now,
    };
  }

  /**
   * Process a game action within an active session.
   *
   * Validates:
   * 1. Session exists
   * 2. User owns the session
   * 3. Session is not ended
   * 4. Action is valid for the current state
   *
   * Computes new state deterministically, updates Redis,
   * and auto-ends the session if game-over is detected.
   *
   * Requirements: 4.3, 4.4, 4.7, 5.1, 5.2, 5.5
   */
  async processAction(sessionId: string, action: GameActionDto, userId: string) {
    // 1. Get session from Redis
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Verify ownership
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your session');
    }

    // 3. Check session not ended (Requirement 5.5)
    if (session.endedAt) {
      throw new ConflictException('Session already ended');
    }

    // 4. Validate action against current state (Requirement 4.4)
    const validationResult = this.validateAction(session.state, action);
    if (!validationResult.valid) {
      throw new BadRequestException({
        message: 'Invalid action for current game state',
        error: validationResult.error,
      });
    }

    // 5. Compute new state deterministically (Requirement 5.1)
    const newState = this.computeNewState(session.state, action);
    const newScore = this.calculateScore(session.score, action, newState);

    // 6. Update session in Redis
    session.state = newState;
    session.score = newScore;
    session.lastActivityAt = new Date().toISOString();
    session.actions.push({
      actionType: action.actionType,
      payload: action.payload,
      timestamp: new Date().toISOString(),
      resultingScore: newScore,
    });
    await this.saveSession(sessionId, session);

    // 7. Check game-over condition (Requirement 4.7)
    if (this.isGameOver(newState)) {
      return this.endSession(sessionId, userId);
    }

    return {
      state: newState,
      score: newScore,
      actionsCount: session.actions.length,
      gameOver: false,
    };
  }

  /**
   * End a game session.
   *
   * Persists final score to PostgreSQL, creates game result record,
   * cleans up Redis session data, and publishes analytics event.
   *
   * Requirements: 4.5, 4.6, 5.5
   */
  async endSession(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Not your session');
    }

    if (session.endedAt) {
      throw new ConflictException('Session already ended');
    }

    const now = new Date();
    const duration = Math.floor(
      (now.getTime() - new Date(session.startedAt).getTime()) / 1000,
    );

    // Persist final score to PostgreSQL
    await this.sessionsRepository.endSession(sessionId, {
      score: session.score,
      endedAt: now,
      duration,
      state: session.state,
      actions: session.actions,
    });

    // Save game result for leaderboards
    await this.sessionsRepository.createGameResult({
      userId: session.userId,
      gameId: session.gameId,
      sessionId,
      score: session.score,
      duration,
    });

    // Clean up Redis
    await this.cacheClient.del(sessionKey(sessionId));

    // Publish analytics event
    await this.analyticsPublisher.publish('analytics-events', {
      eventType: 'game_end',
      userId: session.userId,
      timestamp: now.toISOString(),
      payload: {
        gameId: session.gameId,
        sessionId,
        score: session.score,
        duration,
        actionsCount: session.actions.length,
      },
    });

    return {
      sessionId,
      finalScore: session.score,
      duration,
      actionsCount: session.actions.length,
      gameOver: true,
    };
  }

  /**
   * Handle session timeout expiry.
   * Called by background job to auto-expire inactive sessions.
   *
   * Requirement 4.6: auto-expire inactive sessions and persist last valid state.
   */
  async expireInactiveSessions(timeoutMs: number): Promise<number> {
    const expired = await this.sessionsRepository.findExpiredSessions(timeoutMs);
    let expiredCount = 0;

    for (const session of expired) {
      try {
        // Try to get state from Redis (may already be expired by TTL)
        const cachedSession = await this.getSession(session.id);
        const finalScore = cachedSession?.score ?? session.score ?? 0;
        const finalState = cachedSession?.state ?? session.state;
        const actions = cachedSession?.actions ?? [];

        const now = new Date();
        const startedAt = session.startedAt || now;
        const duration = Math.floor(
          (now.getTime() - new Date(startedAt).getTime()) / 1000,
        );

        // Persist to PostgreSQL
        await this.sessionsRepository.endSession(session.id, {
          score: finalScore,
          endedAt: now,
          duration,
          state: finalState,
          actions,
        });

        // Save game result
        await this.sessionsRepository.createGameResult({
          userId: session.userId,
          gameId: session.gameId,
          sessionId: session.id,
          score: finalScore,
          duration,
        });

        // Clean up Redis (if still exists)
        await this.cacheClient.del(sessionKey(session.id));

        // Publish analytics
        await this.analyticsPublisher.publish('analytics-events', {
          eventType: 'game_timeout',
          userId: session.userId,
          timestamp: now.toISOString(),
          payload: {
            gameId: session.gameId,
            sessionId: session.id,
            score: finalScore,
            duration,
            reason: 'inactivity_timeout',
          },
        });

        expiredCount++;
        this.logger.log(`Session ${session.id} expired due to inactivity`);
      } catch (error) {
        this.logger.error(
          `Failed to expire session ${session.id}: ${(error as Error).message}`,
        );
      }
    }

    return expiredCount;
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Get session data from Redis.
   */
  private async getSession(sessionId: string): Promise<SessionData | null> {
    const raw = await this.cacheClient.get(sessionKey(sessionId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionData;
  }

  /**
   * Save session data to Redis (preserving TTL by re-setting with default TTL).
   */
  private async saveSession(
    sessionId: string,
    session: SessionData,
  ): Promise<void> {
    // Re-save with a reasonable TTL (1 hour from last activity)
    await this.cacheClient.setex(
      sessionKey(sessionId),
      DEFAULT_SESSION_TIMEOUT,
      JSON.stringify(session),
    );
  }

  /**
   * Validate a game action against the current state.
   *
   * Game-generic validation rules:
   * - Cannot act if lives <= 0
   * - Action type must be recognized
   * - Payload must have required fields for the action type
   *
   * Requirement 4.4: reject invalid actions without modifying state
   */
  private validateAction(
    state: GameState,
    action: GameActionDto,
  ): { valid: boolean; error?: string } {
    // Cannot act if game is already over (no lives)
    if (state.lives <= 0) {
      return { valid: false, error: 'Game is over - no lives remaining' };
    }

    // Validate recognized action types
    const validActionTypes = [
      'move',
      'swap',
      'place',
      'rotate',
      'select',
      'submit',
      'use_powerup',
      'skip',
    ];

    if (!validActionTypes.includes(action.actionType)) {
      return {
        valid: false,
        error: `Unrecognized action type: ${action.actionType}`,
      };
    }

    // Validate payload has content
    if (!action.payload || Object.keys(action.payload).length === 0) {
      return { valid: false, error: 'Action payload cannot be empty' };
    }

    return { valid: true };
  }

  /**
   * Compute new game state deterministically.
   *
   * Requirement 5.1: same state + same action always produces the same result.
   * This is a generic game state engine; specific games would override behavior
   * via the customData field.
   */
  private computeNewState(state: GameState, action: GameActionDto): GameState {
    // Deep copy to ensure immutability of the original state
    const newState: GameState = JSON.parse(JSON.stringify(state));

    switch (action.actionType) {
      case 'move':
      case 'swap':
      case 'place':
      case 'rotate':
      case 'select':
        // Score increment based on action (deterministic)
        newState.score += 10;
        break;

      case 'submit':
        // Submit action - may advance level or lose a life
        if (action.payload.correct === true) {
          newState.score += 50;
          // Level up every 200 points
          if (newState.score > 0 && newState.score % 200 === 0) {
            newState.level += 1;
          }
        } else if (action.payload.correct === false) {
          newState.lives -= 1;
        }
        break;

      case 'use_powerup':
        // Use a power-up if available
        const powerUpId = action.payload.powerUpId;
        if (powerUpId && newState.powerUps.includes(powerUpId)) {
          newState.powerUps = newState.powerUps.filter((p) => p !== powerUpId);
          newState.score += 25;
        }
        break;

      case 'skip':
        // Skip costs a life but allows continuing
        newState.lives -= 1;
        break;

      default:
        // No state change for unhandled action types
        break;
    }

    // Store action result in custom data for traceability
    newState.customData = {
      ...newState.customData,
      lastAction: action.actionType,
      lastActionPayload: action.payload,
    };

    return newState;
  }

  /**
   * Calculate score update based on action and resulting state.
   * Returns the cumulative session score.
   */
  private calculateScore(
    currentScore: number,
    action: GameActionDto,
    newState: GameState,
  ): number {
    // The score in the state is the source of truth
    return newState.score;
  }

  /**
   * Check if the game-over condition is met.
   * Requirement 4.7: auto-end session on game-over.
   */
  private isGameOver(state: GameState): boolean {
    return state.lives <= 0;
  }
}
