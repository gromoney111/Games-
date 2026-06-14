/**
 * Branded Types
 *
 * Branded types (also known as "opaque types") provide type-level
 * differentiation between string IDs that are structurally identical
 * but semantically distinct. This prevents accidentally passing a
 * UserId where a GameId is expected.
 */

// ============================================================================
// Brand utility
// ============================================================================

type Brand<K, T> = K & { __brand: T };

// ============================================================================
// ID Types
// ============================================================================

export type UserId = Brand<string, 'UserId'>;
export type GameId = Brand<string, 'GameId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type AffiliateId = Brand<string, 'AffiliateId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type AdId = Brand<string, 'AdId'>;
export type CommissionId = Brand<string, 'CommissionId'>;
export type TrackingCode = Brand<string, 'TrackingCode'>;
export type ReportId = Brand<string, 'ReportId'>;

// ============================================================================
// Value Types
// ============================================================================

export type Email = Brand<string, 'Email'>;
export type Username = Brand<string, 'Username'>;
export type GameSlug = Brand<string, 'GameSlug'>;
export type CurrencyCode = Brand<string, 'CurrencyCode'>;
export type CountryCode = Brand<string, 'CountryCode'>;
export type LanguageCode = Brand<string, 'LanguageCode'>;
export type Url = Brand<string, 'Url'>;
