/**
 * Users Service
 *
 * Business logic layer for user operations. Provides methods for
 * finding and creating users, managing profiles with Redis caching,
 * and accessing user inventory and game history.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersRepository, CreateUserData, CreateProfileData } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Interface for the Redis cache client.
 * Provides get/set/del operations with TTL support.
 */
export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<any>;
  setex(key: string, ttl: number, value: string): Promise<any>;
  del(key: string): Promise<number>;
}

export const CACHE_CLIENT = 'CACHE_CLIENT';

/** Profile cache TTL: 5 minutes in seconds */
const PROFILE_CACHE_TTL = 300;

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(CACHE_CLIENT) private readonly cacheClient: CacheClient,
  ) {}

  /**
   * Find a user by email address.
   * @returns User with profile or null if not found
   */
  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  /**
   * Find a user by ID.
   * @returns User with profile or null if not found
   */
  async findById(id: string) {
    return this.usersRepository.findById(id);
  }

  /**
   * Find a user by username.
   * @returns User with profile or null if not found
   */
  async findByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  /**
   * Create a new user.
   * @param data - User creation data
   * @returns Created user record
   */
  async create(data: CreateUserData) {
    return this.usersRepository.create(data);
  }

  /**
   * Create a user profile.
   * @param data - Profile creation data
   * @returns Created profile record
   */
  async createProfile(data: CreateProfileData) {
    return this.usersRepository.createProfile(data);
  }

  /**
   * Check if an email already exists in the system.
   */
  async emailExists(email: string): Promise<boolean> {
    return this.usersRepository.emailExists(email);
  }

  /**
   * Check if a username already exists in the system.
   */
  async usernameExists(username: string): Promise<boolean> {
    return this.usersRepository.usernameExists(username);
  }

  /**
   * Update the last login timestamp for a user.
   * Called on successful authentication.
   */
  async updateLastLogin(userId: string): Promise<void> {
    return this.usersRepository.updateLastLogin(userId);
  }

  /**
   * Get user profile with Redis caching (5-minute TTL).
   * Tries cache first, falls back to database on cache miss.
   * @returns Full user profile or null if not found
   */
  async getProfile(userId: string): Promise<any | null> {
    const cacheKey = `cache:profile:${userId}`;

    // Try cache first
    try {
      const cached = await this.cacheClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache read failure is non-fatal, fall through to DB
    }

    // Fetch from database
    const profile = await this.usersRepository.findProfileByUserId(userId);
    if (!profile) {
      return null;
    }

    // Store in cache with 5-minute TTL
    try {
      await this.cacheClient.setex(
        cacheKey,
        PROFILE_CACHE_TTL,
        JSON.stringify(profile),
      );
    } catch {
      // Cache write failure is non-fatal
    }

    return profile;
  }

  /**
   * Update user profile with validation.
   * Invalidates the Redis cache after successful update.
   * @returns Updated profile
   * @throws NotFoundException if user does not exist
   * @throws ForbiddenException if account is deactivated
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    // Validate user exists
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If deactivated, reject
    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenException('Account is inactive');
    }

    // Update profile in database
    const updated = await this.usersRepository.updateProfile(userId, dto);

    // Invalidate cache
    const cacheKey = `cache:profile:${userId}`;
    try {
      await this.cacheClient.del(cacheKey);
    } catch {
      // Cache invalidation failure is non-fatal
    }

    return updated;
  }

  /**
   * Get user inventory (purchased items / completed transactions).
   */
  async getInventory(userId: string): Promise<any[]> {
    return this.usersRepository.getInventory(userId);
  }

  /**
   * Get user game history with game details.
   */
  async getGameHistory(userId: string): Promise<any[]> {
    return this.usersRepository.getGameHistory(userId);
  }
}
