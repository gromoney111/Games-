/**
 * Game Data Models
 *
 * Types for games, sessions, state management, actions, and leaderboards.
 */

import {
  GameId,
  SessionId,
  UserId,
  GameSlug,
  Url,
} from '../branded-types.js';
import { GameCategory, GameStatus, ActionType } from '../enums.js';
import { Timestamps, Duration, Pagination } from '../utility-types.js';

// ============================================================================
// Game
// ============================================================================

export interface Game extends Timestamps {
  id: GameId;
  slug: GameSlug;
  title: string;
  description: string;
  category: GameCategory;
  tags: string[];
  thumbnailUrl: Url;
  assets: GameAssets;
  config: GameConfig;
  status: GameStatus;
  seoMetadata: SEOMetadata;
}

export interface GameAssets {
  iconUrl: Url;
  bannerUrl: Url;
  screenshotUrls: Url[];
  gameBundle: Url;
  cdnBaseUrl: Url;
}

export interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  sessionTimeout: Duration;
  maxSessionDuration: Duration;
  maxConcurrentSessions: number;
  difficultyLevels: DifficultyLevel[];
  defaultLives: number;
  scoringRules: Record<string, number>;
}

export interface DifficultyLevel {
  name: string;
  multiplier: number;
  description: string;
}

export interface SEOMetadata {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImage: string;
  structuredData: Record<string, unknown>;
  keywords: string[];
}

// ============================================================================
// Game Session
// ============================================================================

export interface GameSession extends Timestamps {
  id: SessionId;
  userId: UserId;
  gameId: GameId;
  state: GameState;
  score: number;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
  duration: Duration;
  actions: GameAction[];
}

export interface GameState {
  level: number;
  lives: number;
  powerUps: string[];
  checkpoint?: GameCheckpoint;
  customData: Record<string, unknown>;
  isGameOver: boolean;
}

export interface GameCheckpoint {
  level: number;
  score: number;
  state: Record<string, unknown>;
  savedAt: Date;
}

// ============================================================================
// Game Action
// ============================================================================

export interface GameAction {
  actionType: ActionType;
  payload: Record<string, unknown>;
  timestamp: Date;
  resultingScore: number;
}

// ============================================================================
// Game Result
// ============================================================================

export interface GameResult {
  sessionId: SessionId;
  userId: UserId;
  gameId: GameId;
  finalScore: number;
  level: number;
  duration: Duration;
  actions: number;
  completedAt: Date;
  rewards: GameReward[];
}

export interface GameReward {
  type: 'points' | 'badge' | 'item' | 'achievement';
  name: string;
  value: number;
  description: string;
}

// ============================================================================
// Leaderboard
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  userId: UserId;
  username: string;
  avatarUrl?: string;
  score: number;
  achievedAt: Date;
  gameId: GameId;
}

export interface LeaderboardFilter {
  gameId: GameId;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  pagination: Pagination;
}

// ============================================================================
// Game Filter (for catalog queries)
// ============================================================================

export interface GameFilter {
  category?: GameCategory;
  tags?: string[];
  search?: string;
  status?: GameStatus;
}
