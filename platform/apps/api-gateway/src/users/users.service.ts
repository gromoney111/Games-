/**
 * Users Service
 *
 * Business logic layer for user operations. Provides methods for
 * finding and creating users and their profiles.
 */

import { Injectable } from '@nestjs/common';
import { UsersRepository, CreateUserData, CreateProfileData } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

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
}
