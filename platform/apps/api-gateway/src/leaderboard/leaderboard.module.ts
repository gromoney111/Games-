/**
 * Leaderboard Module
 *
 * NestJS module providing game leaderboard functionality.
 * Exposes GET /games/:gameId/leaderboard as a public endpoint.
 *
 * Depends on PrismaModule for database access and the REDIS_CLIENT
 * provider (registered globally in AppModule) for caching.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 19.5
 */

import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardRepository } from './leaderboard.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardRepository],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
