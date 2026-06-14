/**
 * Games Module
 *
 * NestJS module providing game catalog and discovery features.
 * Includes public endpoints for game browsing and admin endpoints
 * for game management (create, update, publish/unpublish).
 *
 * Exports GamesService for use in other modules (e.g., session management).
 */

import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesRepository } from './games.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GamesController],
  providers: [GamesService, GamesRepository],
  exports: [GamesService],
})
export class GamesModule {}
