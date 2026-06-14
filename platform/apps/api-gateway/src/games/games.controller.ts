/**
 * Games Controller
 *
 * Handles game catalog and discovery endpoints:
 * - GET /games — paginated list with category, tag, and search filters (public)
 * - GET /games/:slug — full game detail with SEO metadata (public)
 *
 * Admin game management endpoints:
 * - POST /admin/games — create a new game (admin only)
 * - PUT /admin/games/:id — update a game (admin only)
 * - PATCH /admin/games/:id/status — publish/unpublish/archive (admin only)
 *
 * Public endpoints bypass JWT auth via @Public() decorator.
 * CDN caching headers are set on game detail responses (Requirement 3.5).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 16.3, 16.5
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Query,
  Param,
  Body,
  Res,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { GamesService } from './games.service';
import { ListGamesDto } from './dto/list-games.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  // =========================================================================
  // Public Game Catalog Endpoints
  // =========================================================================

  /**
   * GET /games
   * Returns a paginated list of published games with optional filters.
   * Supports: category, tags (comma-separated), search, page, limit.
   * Default page size: 20, max: 100. Only returns published games.
   *
   * Requirement 3.1: paginated list with category, tags, search filters
   */
  @Public()
  @Get('games')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  async listGames(@Query() query: ListGamesDto) {
    return this.gamesService.listGames(query);
  }

  /**
   * GET /games/:slug
   * Returns full game detail with SEO metadata and CDN asset URLs.
   * Returns 404 if game is not found or not published (no distinction).
   * Sets Cache-Control headers for CDN caching (Requirement 3.5).
   *
   * Requirement 3.2: complete game info + SEO metadata
   * Requirement 3.5: CDN caching headers
   */
  @Public()
  @Get('games/:slug')
  async getGameBySlug(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const game = await this.gamesService.getGameBySlug(slug);

    // Set CDN-friendly caching headers (Requirement 3.5)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.setHeader('Vary', 'Accept-Encoding');

    return game;
  }

  // =========================================================================
  // Admin Game Management Endpoints (Requirement 16.3, 16.5)
  // =========================================================================

  /**
   * POST /admin/games
   * Create a new game. Validates slug URL-safety and uniqueness.
   * Restricted to admin role.
   */
  @Post('admin/games')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async createGame(@Body() dto: CreateGameDto) {
    return this.gamesService.createGame(dto);
  }

  /**
   * PUT /admin/games/:id
   * Update an existing game. Validates slug uniqueness if changed.
   * Restricted to admin role.
   */
  @Put('admin/games/:id')
  @Roles('ADMIN')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async updateGame(
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
  ) {
    return this.gamesService.updateGame(id, dto);
  }

  /**
   * PATCH /admin/games/:id/status
   * Publish, unpublish, or archive a game.
   * Restricted to admin role.
   */
  @Patch('admin/games/:id/status')
  @Roles('ADMIN')
  async updateGameStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.gamesService.updateGameStatus(id, status);
  }
}
