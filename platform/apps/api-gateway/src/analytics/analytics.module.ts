/**
 * Analytics Module
 *
 * NestJS module providing event tracking and reporting features.
 * Includes public event ingestion endpoint and admin-only metrics endpoints.
 *
 * Exports AnalyticsService for use in other modules.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
