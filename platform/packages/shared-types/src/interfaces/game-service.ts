/**
 * IGameService Interface
 *
 * Contract for game catalog management, session lifecycle,
 * action processing, and leaderboard operations.
 */

import { GameId, SessionId, UserId } from '../branded-types.js';
import { Pagination, PagedResult } from '../utility-types.js';
import {
  Game,
  GameSession,
  GameState,
  GameAction,
  GameResult,
  GameFilter,
  LeaderboardEntry,
  LeaderboardFilter,
} from '../models/game.js';

// ============================================================================
// Game Service Interface
// ============================================================================

export interface IGameService {
  /**
   * List games with filtering and pagination.
   * Returns published games matching category, tags, or search criteria.
   */
  listGames(filter: GameFilter, pagination: Pagination): Promise<PagedResult<Game>>;

  /**
   * Get full game details by ID including config and SEO metadata.
   */
  getGame(gameId: GameId): Promise<Game>;

  /**
   * Get full game details by slug for public-facing URLs.
   */
  getGameBySlug(slug: string): Promise<Game>;

  /**
   * Start a new game session for a user.
   * Validates user is active, game is published, concurrent limit not exceeded.
   */
  startSession(userId: UserId, gameId: GameId): Promise<GameSession>;

  /**
   * Process a game action within an active session.
   * Validates action against current state, computes new state deterministically.
   */
  processAction(sessionId: SessionId, action: GameAction): Promise<GameState>;

  /**
   * End a game session, persist final score, and return results.
   */
  endSession(sessionId: SessionId): Promise<GameResult>;

  /**
   * Get the current state of an active session.
   */
  getSessionState(sessionId: SessionId): Promise<GameState>;

  /**
   * Get the leaderboard for a game with time period filter.
   * Sorted descending by score, ties broken by earliest timestamp.
   */
  getLeaderboard(filter: LeaderboardFilter): Promise<LeaderboardEntry[]>;

  /**
   * Get game history for a specific user and game.
   */
  getHistory(userId: UserId, gameId: GameId): Promise<GameResult[]>;

  /**
   * Get active sessions for a user.
   */
  getActiveSessions(userId: UserId): Promise<GameSession[]>;
}
