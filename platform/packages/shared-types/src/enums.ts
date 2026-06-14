/**
 * Shared Enums
 *
 * All platform-wide enumeration types used across services.
 */

// ============================================================================
// User Enums
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

// ============================================================================
// Game Enums
// ============================================================================

export enum GameCategory {
  PUZZLE = 'puzzle',
  ACTION = 'action',
  STRATEGY = 'strategy',
  CASUAL = 'casual',
  MULTIPLAYER = 'multiplayer',
  EDUCATIONAL = 'educational',
}

export enum GameStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  SUSPENDED = 'suspended',
}

export enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  USE_ITEM = 'use_item',
  INTERACT = 'interact',
  SWAP = 'swap',
  PLACE = 'place',
  ROTATE = 'rotate',
  SKIP = 'skip',
  CUSTOM = 'custom',
}

// ============================================================================
// Transaction Enums
// ============================================================================

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
  PENDING_CONFIRMATION = 'pending_confirmation',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  GOOGLE_PAY = 'google_pay',
  APPLE_PAY = 'apple_pay',
  BANK_TRANSFER = 'bank_transfer',
}

// ============================================================================
// Affiliate Enums
// ============================================================================

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

export enum CommissionStatus {
  PENDING = 'pending',
  CREDITED = 'credited',
  PAID = 'paid',
  REJECTED = 'rejected',
  WITHHELD = 'withheld',
}

// ============================================================================
// Notification Enums
// ============================================================================

export enum NotificationType {
  PURCHASE_CONFIRMATION = 'purchase_confirmation',
  COMMISSION_EARNED = 'commission_earned',
  SECURITY_ALERT = 'security_alert',
  ACCOUNT_LOCKED = 'account_locked',
  PASSWORD_CHANGED = 'password_changed',
  NEW_DEVICE_LOGIN = 'new_device_login',
  PAYOUT_PROCESSED = 'payout_processed',
  GAME_REWARD = 'game_reward',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}
