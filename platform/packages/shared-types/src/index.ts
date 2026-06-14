/**
 * Shared Types Package
 *
 * Central type definitions used across all apps and services.
 * Exports interfaces, enums, and type utilities for the gaming platform.
 */

// ============================================================================
// Enums
// ============================================================================

export enum UserRole {
  PLAYER = 'player',
  ADMIN = 'admin',
  AFFILIATE = 'affiliate',
  MODERATOR = 'moderator',
}

export enum AccountStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

export enum GameCategory {
  PUZZLE = 'puzzle',
  ACTION = 'action',
  STRATEGY = 'strategy',
  CASUAL = 'casual',
  MULTIPLAYER = 'multiplayer',
  EDUCATIONAL = 'educational',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum AffiliateTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export enum AffiliateStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

// ============================================================================
// Base Types
// ============================================================================

export type UserId = string;
export type GameId = string;
export type SessionId = string;
export type TransactionId = string;
export type AffiliateId = string;
export type ItemId = string;

// ============================================================================
// Interfaces (placeholders - will be fully defined in Task 1.2)
// ============================================================================

export interface User {
  id: UserId;
  email: string;
  username: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: GameId;
  slug: string;
  title: string;
  description: string;
  category: GameCategory;
  tags: string[];
}

export interface GameSession {
  id: SessionId;
  userId: UserId;
  gameId: GameId;
  score: number;
  startedAt: Date;
  endedAt?: Date;
}

export interface Transaction {
  id: TransactionId;
  userId: UserId;
  amount: number;
  currency: string;
  status: TransactionStatus;
}

export interface Affiliate {
  id: AffiliateId;
  userId: UserId;
  status: AffiliateStatus;
  tier: AffiliateTier;
  trackingCode: string;
}
