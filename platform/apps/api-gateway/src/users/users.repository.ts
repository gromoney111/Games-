/**
 * Users Repository
 *
 * Database access layer for user operations via Prisma ORM.
 * Provides CRUD operations for users, user profiles, inventory, and game history.
 * Includes GDPR data portability and account lifecycle operations.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  role?: string;
  status?: string;
}

export interface CreateProfileData {
  userId: string;
  displayName?: string;
  preferredLanguage?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by email address.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { profile: true },
    });
  }

  /**
   * Find a user by ID.
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  /**
   * Find a user by username.
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });
  }

  /**
   * Create a new user record in the database.
   */
  async create(data: CreateUserData) {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        passwordHash: data.passwordHash,
        role: 'PLAYER',
        status: 'PENDING',
      },
      include: { profile: true },
    });
  }

  /**
   * Create a user profile.
   */
  async createProfile(data: CreateProfileData) {
    return this.prisma.userProfile.create({
      data: {
        userId: data.userId,
        displayName: data.displayName || data.userId,
        preferredLanguage: data.preferredLanguage || 'en',
      },
    });
  }

  /**
   * Check if an email already exists.
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Check if a username already exists.
   */
  async usernameExists(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { username: username.toLowerCase() },
    });
    return count > 0;
  }

  /**
   * Update the last login timestamp for a user.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Find a user profile by user ID.
   * Returns the full profile with all fields.
   */
  async findProfileByUserId(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Update a user profile.
   * @param userId - The user ID whose profile to update
   * @param data - Partial profile update data
   * @returns Updated profile record
   */
  async updateProfile(userId: string, data: Partial<UpdateProfileDto>) {
    return this.prisma.userProfile.update({
      where: { userId },
      data,
    });
  }

  /**
   * Get user inventory (completed transactions).
   * Returns transactions sorted by most recent first.
   */
  async getInventory(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user game history with game details.
   * Returns the most recent 50 game results.
   */
  async getGameHistory(userId: string) {
    return this.prisma.gameResult.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 50,
      include: {
        game: {
          select: { title: true, slug: true, category: true },
        },
      },
    });
  }

  // =========================================================================
  // GDPR and Account Lifecycle Methods
  // =========================================================================

  /**
   * Update a user's account status.
   * Used for account deactivation and deletion scheduling.
   */
  async updateStatus(userId: string, status: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
    });
  }

  /**
   * Get all transactions for a user (GDPR data export).
   */
  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all consent records for a user (GDPR data export).
   */
  async getConsentRecords(userId: string) {
    return this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get all game sessions for a user (GDPR data export).
   */
  async getGameSessions(userId: string) {
    return this.prisma.gameSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Get all notifications for a user (GDPR data export).
   */
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Schedule a user account for deletion by updating status
   * and recording the deletion metadata.
   * The actual deletion occurs after 30 days (handled by background job).
   */
  async scheduleForDeletion(userId: string, deletionDate: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DEACTIVATED' as any,
      },
    });

    // Record the deletion schedule in the audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ACCOUNT_DELETION_SCHEDULED',
        targetType: 'USER',
        targetId: userId,
        metadata: {
          scheduledDeletionDate: deletionDate.toISOString(),
          reason: 'GDPR_RIGHT_TO_ERASURE',
        },
      },
    });
  }
}
