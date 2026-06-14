/**
 * Auth Controller
 *
 * Handles authentication-related HTTP endpoints:
 * - POST /auth/register - User registration
 * - POST /auth/login - User authentication
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
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/guards/jwt-auth.guard';

class LoginDto {
  email!: string;
  password!: string;
}

class RefreshDto {
  refreshToken!: string;
}

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
   * Authenticate user and issue token pair.
   * Placeholder - full implementation in Task 3.2
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /**
   * POST /auth/refresh
   *
   * Refresh access token using a valid refresh token.
   * Placeholder - full implementation in Task 3.5
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /auth/logout
   *
   * Logout and invalidate tokens.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: RequestUser) {
    await this.authService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }
}
