/**
 * Users Repository
 *
 * Database access layer for user operations via Prisma ORM.
 * Provides CRUD operations for users and user profiles.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
