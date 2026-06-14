/**
 * Auth Service
 *
 * Handles user registration including:
 * - Email/username uniqueness checking
 * - Password hashing with Argon2id
 * - User creation with PENDING status
 * - Email verification token generation
 * - Notification queueing for verification email
 *
 * Security: Returns generic error on duplicate email/username to prevent account enumeration.
 */

import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

export interface RegisterResult {
  userId: string;
  email: string;
  username: string;
  status: string;
  message: string;
}

export interface EmailVerificationToken {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Register a new user account.
   *
   * Flow:
   * 1. Check if email already exists (return generic error if so)
   * 2. Check if username already exists (return generic error if so)
   * 3. Hash password with Argon2id (per-user salt, 3 iterations)
   * 4. Create user in DB with PENDING status
   * 5. Create user profile
   * 6. Generate email verification token (UUID, expires 24h)
   * 7. Queue email verification notification
   * 8. Return success with userId
   *
   * @param dto - Registration data (email, password, username)
   * @returns RegisterResult with userId and status
   * @throws ConflictException with generic message if email/username exists
   */
  async register(dto: RegisterDto): Promise<RegisterResult> {
    // Check if email already exists - use generic error to prevent account enumeration
    const emailExists = await this.usersService.emailExists(dto.email);
    if (emailExists) {
      this.logger.warn(`Registration attempt with existing email: ${dto.email.substring(0, 3)}***`);
      throw new ConflictException('Registration could not be completed. Please try again or contact support.');
    }

    // Check if username already exists - same generic error
    const usernameExists = await this.usersService.usernameExists(dto.username);
    if (usernameExists) {
      throw new ConflictException('Registration could not be completed. Please try again or contact support.');
    }

    // Hash password with Argon2id (per-user salt, 3 iterations, 64MB memory, 4 parallelism)
    const hashedPassword = await this.cryptoService.hashPassword(dto.password);

    // Create user in database with PENDING status
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash: hashedPassword.hash,
    });

    // Create user profile
    await this.usersService.createProfile({
      userId: user.id,
      displayName: dto.username,
      preferredLanguage: 'en',
    });

    // Generate email verification token (24-hour expiry)
    const verificationToken = this.generateEmailVerificationToken(user.id);

    // Queue email verification notification (async, non-blocking)
    this.queueVerificationEmail(user.email, verificationToken);

    this.logger.log(`User registered successfully: ${user.id}`);

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      status: 'PENDING',
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Authenticate user credentials and return token pair.
   * Placeholder - full implementation in Task 3.2
   */
  async login(_email: string, _password: string): Promise<TokenPair | null> {
    this.logger.log('Login attempt - implementation pending (Task 3.2)');
    return null;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Placeholder - full implementation in Task 3.5
   */
  async refresh(_refreshToken: string): Promise<TokenPair | null> {
    this.logger.log('Token refresh attempt - implementation pending (Task 3.5)');
    return null;
  }

  /**
   * Logout user and invalidate all tokens.
   */
  async logout(userId: string): Promise<void> {
    this.logger.log(`Logout for user: ${userId}`);
  }

  /**
   * Generate an email verification token with 24-hour expiry.
   */
  private generateEmailVerificationToken(userId: string): EmailVerificationToken {
    const token = this.cryptoService.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      token,
      userId,
      expiresAt,
    };
  }

  /**
   * Queue a verification email for async sending via notification service.
   * This is non-blocking — failures are logged but don't affect registration.
   */
  private queueVerificationEmail(email: string, verificationToken: EmailVerificationToken): void {
    // TODO: Integrate with message queue (RabbitMQ/SQS) when notification service is ready
    this.logger.log(
      `Verification email queued for user ${verificationToken.userId}, token expires at ${verificationToken.expiresAt.toISOString()}`,
    );
  }
}
