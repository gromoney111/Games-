/**
 * Users Controller
 *
 * Handles user profile CRUD operations and GDPR compliance:
 * - GET /users/:id/profile - retrieve full profile (with Redis caching)
 * - PUT /users/:id/profile - update profile with validation
 * - GET /users/:id/inventory - retrieve user inventory
 * - GET /users/:id/game-history - retrieve game history
 * - POST /users/:id/deactivate - deactivate account (GDPR)
 * - GET /users/:id/export - export all user data (GDPR Article 20)
 * - DELETE /users/:id - right to erasure, 30-day deletion (GDPR Article 17)
 *
 * Access control: users can only access their own data unless they have ADMIN role.
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
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

  // =========================================================================
  // GDPR Data Portability and Account Lifecycle Endpoints
  // =========================================================================

  /**
   * POST /users/:id/deactivate
   * Deactivates the user account, terminates all active sessions,
   * and queues a data export (available within 72 hours per requirement 2.7).
   */
  @Post(':id/deactivate')
  async deactivateAccount(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot deactivate other users\' accounts');
    }

    // Deactivate account (set status to DEACTIVATED)
    await this.usersService.deactivateAccount(id);

    // Terminate all active sessions for this user
    await this.usersService.terminateAllSessions(id);

    // Trigger data export (async, available within 72 hours)
    const exportId = await this.usersService.queueDataExport(id);

    return {
      message: 'Account deactivated. Data export will be available within 72 hours.',
      exportId,
    };
  }

  /**
   * GET /users/:id/export
   * Exports all user data in machine-readable JSON format.
   * GDPR Article 20 - Right to Data Portability compliance.
   */
  @Get(':id/export')
  async exportData(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot export other users\' data');
    }

    const exportData = await this.usersService.exportUserData(id);
    return exportData;
  }

  /**
   * DELETE /users/:id
   * Schedules account for permanent deletion within 30 days.
   * GDPR Article 17 - Right to Erasure compliance.
   */
  @Delete(':id')
  async deleteAccount(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.userId !== id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Cannot delete other users\' accounts');
    }

    // Schedule deletion within 30 days (GDPR right to erasure)
    const deletionDate = await this.usersService.scheduleAccountDeletion(id);

    return {
      message: 'Account scheduled for deletion. All data will be permanently removed within 30 days.',
      deletionDate,
    };
  }
}
