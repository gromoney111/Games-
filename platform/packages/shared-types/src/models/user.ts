/**
 * User Data Models
 *
 * Types for user accounts, profiles, credentials, and authentication.
 */

import {
  UserId,
  Email,
  Username,
  CountryCode,
  LanguageCode,
  Url,
} from '../branded-types.js';
import { UserRole, AccountStatus, NotificationType } from '../enums.js';
import { Timestamps } from '../utility-types.js';

// ============================================================================
// User
// ============================================================================

export interface User extends Timestamps {
  id: UserId;
  email: Email;
  username: Username;
  passwordHash: PasswordHash;
  role: UserRole;
  status: AccountStatus;
  profile: UserProfile;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  emailVerified: boolean;
}

// ============================================================================
// User Profile
// ============================================================================

export interface UserProfile {
  displayName: string;
  avatarUrl?: Url;
  bio?: string;
  country?: CountryCode;
  preferredLanguage: LanguageCode;
  dateOfBirth?: Date;
  notificationPrefs: NotificationPreferences;
  privacySettings: PrivacySettings;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  enabledTypes: NotificationType[];
}

export interface PrivacySettings {
  profilePublic: boolean;
  showOnLeaderboard: boolean;
  allowAdTracking: boolean;
  dataProcessingConsent: boolean;
  consentTimestamp?: Date;
}

// ============================================================================
// Credentials and Auth
// ============================================================================

export interface Credentials {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface PasswordHash {
  hash: string;
  salt: string;
  algorithm: 'argon2id';
  iterations: number;
}

// ============================================================================
// Profile Update DTO
// ============================================================================

export interface ProfileUpdate {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  country?: string;
  preferredLanguage?: string;
  dateOfBirth?: Date;
  notificationPrefs?: Partial<NotificationPreferences>;
  privacySettings?: Partial<PrivacySettings>;
}
