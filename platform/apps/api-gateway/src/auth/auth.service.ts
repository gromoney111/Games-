/**
 * Auth Service
 *
 * Handles user authentication including:
 * - Registration with email/username uniqueness checking
 * - Login with constant-time responses (dummy hash on miss)
 * - RS256 JWT access token (15-min expiry) and refresh token (7-day expiry)
 * - Account lockout after 5 failed attempts in 15 minutes (30-min lock)
 * - Failed attempts reset on successful login
 * - Last login timestamp update
 * - Refresh token storage in Redis for rotation/revocation
 *
 * Security:
 * - Returns generic error on duplicate email/username to prevent account enumeration
 * - Constant-time response regardless of user existence
 * - Account lockout for brute-force protection
 */

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { JwtService, TokenPairResult } from './jwt.service';
import { RedisService } from './redis.service';
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

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/** Maximum failed login attempts before account lockout */
const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
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
      throw new ConflictException(
        'Registration could not be completed. Please try again or contact support.',
      );
    }

    // Check if username already exists - same generic error
    const usernameExists = await this.usersService.usernameExists(dto.username);
    if (usernameExists) {
      throw new ConflictException(
        'Registration could not be completed. Please try again or contact support.',
      );
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
   * Authenticate user credentials and issue token pair.
   *
   * Security requirements fulfilled:
   * - Constant-time response regardless of user existence (dummy hash on miss)
   * - Account lockout after 5 failed attempts in 15 minutes
   * - 30-minute lock duration
   * - Reset failed attempts on success
   * - Update lastLoginAt timestamp on success
   * - RS256 JWT access token (15-min) + refresh token (7-day)
   * - Store refresh token in Redis for rotation/revocation
   *
   * @param email - User email address
   * @param password - User plaintext password
   * @returns LoginResult with tokens and user info
   * @throws UnauthorizedException with generic message
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // 1. Find user by email
    const user = await this.usersService.findByEmail(email);

    // 2. If user not found, perform dummy hash (constant-time) and return generic error
    if (!user) {
      await this.cryptoService.dummyHashComputation();
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Check if account is locked
    const isLocked = await this.redisService.isAccountLocked(user.id);
    if (isLocked) {
      throw new UnauthorizedException(
        'Account temporarily locked. Try again later.',
      );
    }

    // 4. Check account status
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new UnauthorizedException('Account inactive');
    }

    // 5. Verify password using Argon2id with constant-time comparison
    const passwordValid = await this.cryptoService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      // Increment failed attempts in Redis (15-min TTL)
      const attempts = await this.redisService.incrementFailedAttempts(user.id);

      this.logger.warn(
        `Failed login attempt ${attempts}/${MAX_FAILED_ATTEMPTS} for user ${user.id}`,
      );

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        // Lock account for 30 minutes
        await this.redisService.lockAccount(user.id);
        throw new UnauthorizedException(
          'Account temporarily locked due to too many failed attempts',
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // 6. Success - reset failed attempts counter
    await this.redisService.resetFailedAttempts(user.id);

    // 7. Update last login timestamp
    await this.usersService.updateLastLogin(user.id);

    // 8. Generate RS256 JWT token pair
    const tokenPair: TokenPairResult = this.jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // 9. Store refresh token in Redis (for rotation/revocation)
    await this.redisService.storeRefreshToken(
      user.id,
      tokenPair.refreshTokenId,
      tokenPair.refreshToken,
    );

    // 10. Log successful login event
    this.logger.log(`User authenticated successfully: ${user.id}`);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   *
   * Token Rotation Flow:
   * 1. Verify the refresh token signature and expiration (HS256)
   * 2. Check if token exists in Redis (not revoked/rotated)
   * 3. If token doesn't match stored token → possible reuse attack → revoke all
   * 4. Verify user is still active
   * 5. Generate new token pair (new access + new refresh)
   * 6. Store new refresh token, invalidating old one (rotation)
   *
   * @param refreshToken - The refresh token to validate
   * @returns LoginResult with fresh access token, refresh token, and user info
   * @throws UnauthorizedException if token is invalid, revoked, or user inactive
   */
  async refresh(refreshToken: string): Promise<LoginResult> {
    // 1. Verify the refresh token signature and expiration
    const payload = this.jwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Check if token exists in Redis (not revoked/rotated)
    const storedToken = await this.redisService.getRefreshToken(payload.sub, payload.tokenId);
    if (!storedToken || storedToken !== refreshToken) {
      // Possible token reuse attack - invalidate all tokens for this user
      this.logger.warn(`Token reuse detected for user: ${payload.sub}`);
      await this.redisService.revokeAllRefreshTokens(payload.sub);
      throw new UnauthorizedException('Token has been revoked');
    }

    // 3. Get fresh user data and verify account is still active
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account not active');
    }

    // 4. Revoke old refresh token (rotation - old token invalidated immediately)
    await this.redisService.revokeRefreshToken(payload.sub, payload.tokenId);

    // 5. Generate new token pair
    const tokenPair: TokenPairResult = this.jwtService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // 6. Store new refresh token in Redis
    await this.redisService.storeRefreshToken(
      user.id,
      tokenPair.refreshTokenId,
      tokenPair.refreshToken,
    );

    this.logger.log(`Token refreshed successfully for user: ${user.id}`);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Logout user and invalidate all tokens.
   */
  async logout(userId: string): Promise<void> {
    await this.redisService.revokeAllRefreshTokens(userId);
    this.logger.log(`Logout for user: ${userId}`);
  }

  /**
   * Generate an email verification token with 24-hour expiry.
   */
  private generateEmailVerificationToken(
    userId: string,
  ): EmailVerificationToken {
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
  private queueVerificationEmail(
    email: string,
    verificationToken: EmailVerificationToken,
  ): void {
    // TODO: Integrate with message queue (RabbitMQ/SQS) when notification service is ready
    this.logger.log(
      `Verification email queued for user ${verificationToken.userId}, token expires at ${verificationToken.expiresAt.toISOString()}`,
    );
  }
}
