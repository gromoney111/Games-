/**
 * Leaderboard Controller
 *
 * Exposes the public endpoint for retrieving game leaderboards:
 * - GET /games/:gameId/leaderboard — returns ranked player scores
 *
 * Supports time period filtering (daily, weekly, monthly, all-time)
 * and configurable result limit (1–1000, default 50).
 *
 * Public endpoint — no JWT authentication required.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('games')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET /games/:gameId/leaderboard
   *
   * Returns the leaderboard for the specified game.
   * Scores are sorted descending; ties broken by earliest timestamp.
   * Each entry has a unique sequential rank from 1 to N.
   *
   * Query parameters:
   * - period: 'daily' | 'weekly' | 'monthly' | 'all-time' (default: 'all-time')
   * - limit: 1–1000 (default: 50)
   *
   * Requirement 6.1: ranked list sorted descending by score
   * Requirement 6.2: tie-breaking by earliest achievement timestamp
   * Requirement 6.3: limit between 1 and 1000
   * Requirement 6.4: unique sequential ranks 1..N
   */
  @Public()
  @Get(':gameId/leaderboard')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  async getLeaderboard(
    @Param('gameId') gameId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.leaderboardService.getLeaderboard(gameId, query);
  }
}
