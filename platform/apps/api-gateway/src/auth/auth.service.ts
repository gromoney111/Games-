import { Injectable, Logger, ConflictException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { UsersService } from '../users/users.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResult {
  message: string;
  userId: string;
  email: string;
  username: string;
  status: string;
}

/**
 * Auth Service
 *
 * Handles authentication operations including registration, login,
 * token refresh, and logout. Uses CryptoService for password hashing
 * and UsersService for persistence.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Register a new user account.
   * - Validates email and username uniqueness (generic error to prevent enumeration)
   * - Hashes password with Argon2id
   * - Creates user with PENDING status
   * - Creates default user profile
   */
  async register(input: RegisterInput): Promise<RegisterResult> {
    this.logger.log(`Registration attempt for: ${input.email}`);

    // Check email existence
    const emailExists = await this.usersService.emailExists(input.email);
    if (emailExists) {
      throw new ConflictException('Registration could not be completed');
    }

    // Check username existence
    const usernameExists = await this.usersService.usernameExists(input.username);
    if (usernameExists) {
      throw new ConflictException('Registration could not be completed');
    }

    // Hash password with Argon2id
    const hashedPassword = await this.cryptoService.hashPassword(input.password);

    // Create user
    const user = await this.usersService.create({
      email: input.email,
      username: input.username,
      passwordHash: hashedPassword.hash,
    });

    // Create user profile
    await this.usersService.createProfile({
      userId: user.id,
      displayName: input.username,
      preferredLanguage: 'en',
    });

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
    };
  }

  /**
   * Authenticate user credentials and return token pair.
   * Will be fully implemented in Task 3.2.
   */
  async login(email: string, password: string): Promise<TokenPair | null> {
    this.logger.log(`Login attempt for: ${email}`);
    // Placeholder - will be implemented in Task 3.2
    return null;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Will be fully implemented in Task 3.5.
   */
  async refresh(refreshToken: string): Promise<TokenPair | null> {
    this.logger.log('Token refresh attempt');
    // Placeholder - will be implemented in Task 3.5
    return null;
  }

  /**
   * Logout user and invalidate all tokens.
   */
  async logout(userId: string): Promise<void> {
    this.logger.log(`Logout for user: ${userId}`);
    // Placeholder - will invalidate refresh tokens
  }
}
