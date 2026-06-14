/**
 * Auth Controller
 *
 * Handles authentication-related HTTP endpoints:
 * - POST /auth/register - User registration
 * - POST /auth/login - User authentication (constant-time, account lockout)
 * - POST /auth/refresh - Token refresh
 * - POST /auth/logout - Session invalidation
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   *
   * Register a new user account.
   * Validates email (RFC 5322), password (complexity), and username (alphanumeric).
   * Returns 201 Created with userId on success.
   * Returns 409 Conflict with generic error if email/username exists.
   * Returns 400 Bad Request if validation fails.
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   *
   * Authenticate user and issue RS256 JWT token pair.
   * - Access token: 15-minute expiry
   * - Refresh token: 7-day expiry
   *
   * Security:
   * - Constant-time response regardless of user existence
   * - Account lockout after 5 failed attempts (30-min lock)
   * - Resets failed attempts on success
   * - Updates lastLoginAt timestamp
   *
   * Returns 200 OK with { accessToken, refreshToken, expiresIn, user }
   * Returns 401 Unauthorized with generic message on failure
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /auth/refresh
   *
   * Refresh access token using a valid refresh token.
   * Validates the refresh token, issues a new token pair (rotation),
   * and invalidates the old refresh token immediately.
   *
   * Token Rotation Security:
   * - Old refresh token is invalidated on each use
   * - If a previously-used token is presented (reuse detection),
   *   ALL tokens for the user are revoked
   * - User account status is verified on each refresh
   *
   * No JWT Bearer token required (@Public) since the access token IS expired.
   *
   * Returns 200 OK with { accessToken, refreshToken, expiresIn, user }
   * Returns 401 Unauthorized if token is invalid, expired, revoked, or user inactive
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /auth/logout
   *
   * Logout and invalidate all refresh tokens for the user.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: RequestUser) {
    await this.authService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }
}
