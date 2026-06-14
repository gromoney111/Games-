/**
 * Shared Types Package
 *
 * Central type definitions used across all apps and services.
 * Exports branded types, enums, data models, service interfaces,
 * and utility types for the gaming platform.
 */

// ============================================================================
// Branded Types (type-safe IDs and value types)
// ============================================================================

export type {
  UserId,
  GameId,
  SessionId,
  TransactionId,
  AffiliateId,
  ItemId,
  AdId,
  CommissionId,
  TrackingCode,
  ReportId,
  Email,
  Username,
  GameSlug,
  CurrencyCode,
  CountryCode,
  LanguageCode,
  Url,
} from './branded-types.js';

// ============================================================================
// Enums
// ============================================================================

export {
  UserRole,
  AccountStatus,
  GameCategory,
  GameStatus,
  ActionType,
  TransactionStatus,
  PaymentMethod,
  AffiliateTier,
  AffiliateStatus,
  CommissionStatus,
  NotificationType,
} from './enums.js';

// ============================================================================
// Utility Types
// ============================================================================

export type {
  Pagination,
  PagedResult,
  DateRange,
  Duration,
  ApiResponse,
  ApiError,
  SortOrder,
  SortOption,
  Timestamps,
} from './utility-types.js';

// ============================================================================
// Data Models - User
// ============================================================================

export type {
  User,
  UserProfile,
  Credentials,
  TokenPair,
  PasswordHash,
  NotificationPreferences,
  PrivacySettings,
  ProfileUpdate,
} from './models/user.js';

// ============================================================================
// Data Models - Game
// ============================================================================

export type {
  Game,
  GameAssets,
  GameConfig,
  DifficultyLevel,
  SEOMetadata,
  GameSession,
  GameState,
  GameCheckpoint,
  GameAction,
  GameResult,
  GameReward,
  LeaderboardEntry,
  LeaderboardFilter,
  GameFilter,
} from './models/game.js';

// ============================================================================
// Data Models - Transaction
// ============================================================================

export type {
  Money,
  Transaction,
  TransactionMetadata,
  TransactionStateChange,
  PurchaseRequest,
  PaymentIntent,
  PurchasableItem,
  Receipt,
  RefundResult,
} from './models/transaction.js';

// ============================================================================
// Data Models - Affiliate
// ============================================================================

export type {
  Affiliate,
  AffiliateEarnings,
  Commission,
  TrackingLink,
  ConversionEvent,
  PayoutInfo,
  PayoutRequest,
  PayoutResult,
} from './models/affiliate.js';

// ============================================================================
// Data Models - Analytics
// ============================================================================

export type {
  AnalyticsEvent,
  EventContext,
  PageViewEvent,
  UserMetrics,
  GameMetrics,
  RevenueMetrics,
  RevenueBySource,
  SEOMetrics,
  KeywordMetric,
  Report,
  ReportType,
  ReportParams,
} from './models/analytics.js';

// ============================================================================
// Data Models - Ad
// ============================================================================

export type {
  AdUnit,
  AdPlacement,
  AdSize,
  AdFormat,
  AdContent,
  AdTargeting,
  FrequencyCap,
  AdContext,
  AdImpression,
  AnonymousImpression,
  ImpressionContext,
  DeviceInfo,
  AdRevenueReport,
  AdPagePerformance,
} from './models/ad.js';

// ============================================================================
// Service Interfaces
// ============================================================================

export type { IUserService } from './interfaces/user-service.js';
export type { IGameService } from './interfaces/game-service.js';
export type { IPaymentService, WebhookEvent } from './interfaces/payment-service.js';
export type {
  IAffiliateService,
  AffiliateApplication,
  ClickContext,
  GeoLocation,
} from './interfaces/affiliate-service.js';
export type { IAnalyticsService } from './interfaces/analytics-service.js';
export type { IAdService } from './interfaces/ad-service.js';
