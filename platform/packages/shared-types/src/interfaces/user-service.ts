/**
 * IUserService Interface
 *
 * Contract for user registration, authentication, profile management,
 * and GDPR compliance operations.
 */

import { UserId } from '../branded-types.js';
import {
  User,
  UserProfile,
  Credentials,
  TokenPair,
  ProfileUpdate,
} from '../models/user.js';

// ============================================================================
// User Service Interface
// ============================================================================

export interface IUserService {
  /**
   * Register a new user with email and password.
   * Creates account with pending status and sends verification email.
   */
  register(credentials: Credentials): Promise<User>;

  /**
   * Authenticate user credentials.
   * Returns token pair on success; enforces constant-time response.
   */
  authenticate(credentials: Credentials): Promise<TokenPair>;

  /**
   * Refresh an access token using a valid refresh token.
   * Performs token rotation (invalidates old refresh token).
   */
  refreshToken(refreshToken: string): Promise<TokenPair>;

  /**
   * Get the full user profile by ID.
   */
  getProfile(userId: UserId): Promise<UserProfile>;

  /**
   * Update user profile with validated data.
   */
  updateProfile(userId: UserId, update: ProfileUpdate): Promise<UserProfile>;

  /**
   * Verify a user's email using the verification token.
   */
  verifyEmail(token: string): Promise<void>;

  /**
   * Deactivate a user account (soft delete).
   */
  deactivateAccount(userId: UserId): Promise<void>;

  /**
   * Export all user data in machine-readable format (GDPR data portability).
   */
  exportUserData(userId: UserId): Promise<Record<string, unknown>>;

  /**
   * Delete all user personal data (GDPR right to erasure).
   * Must complete within 30 days.
   */
  deleteUserData(userId: UserId): Promise<void>;

  /**
   * Reset password using a valid reset token.
   */
  resetPassword(token: string, newPassword: string): Promise<void>;

  /**
   * Request a password reset link via email.
   */
  requestPasswordReset(email: string): Promise<void>;
}
