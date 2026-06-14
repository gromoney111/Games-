/**
 * Users Controller
 *
 * Handles user profile CRUD operations:
 * - GET /users/:id/profile - retrieve full profile (with Redis caching)
 * - PUT /users/:id/profile - update profile with validation
 * - GET /users/:id/inventory - retrieve user inventory
 * - GET /users/:id/game-history - retrieve game history
 *
 * Access control: users can only access their own data unless they have ADMIN role.
 */

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/:id/profile
   * Returns the full user profile including display name, avatar, bio,
   * country, language preference, notification prefs, and privacy settings.
   * Uses Redis caching with 5-minute TTL.
   */
  @Get(':id/profile')
  async getProfile(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    // Access control: own profile or admin only
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot access other users\' profiles');
    }

    const profile = await this.usersService.getProfile(id);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    return profile;
  }

  /**
   * PUT /users/:id/profile
   * Updates the user profile with validation.
   * Returns specific validation errors for invalid data.
   * Invalidates Redis cache on successful update.
   */
  @Put(':id/profile')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Access control: own profile or admin only
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot update other users\' profiles');
    }

    return this.usersService.updateProfile(id, dto);
  }

  /**
   * GET /users/:id/inventory
   * Returns the user's purchased items / inventory.
   */
  @Get(':id/inventory')
  async getInventory(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot access other users\' inventory');
    }

    return this.usersService.getInventory(id);
  }

  /**
   * GET /users/:id/game-history
   * Returns the user's game history with game details.
   */
  @Get(':id/game-history')
  async getGameHistory(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot access other users\' game history');
    }

    return this.usersService.getGameHistory(id);
  }
}
