/**
 * Analytics Controller
 *
 * Handles analytics event tracking and admin reporting endpoints:
 * - POST /analytics/events — track analytics events (public)
 * - GET /admin/analytics/users — user engagement metrics (admin only)
 * - GET /admin/analytics/games — game performance metrics (admin only)
 * - GET /admin/analytics/revenue — revenue metrics (admin only)
 *
 * Public event tracking allows frontend to send events without auth.
 * Admin reporting endpoints require admin role.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { DateRangeDto } from './dto/date-range.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * POST /analytics/events
   * Track an analytics event from the frontend.
   * Public endpoint — no authentication required.
   *
   * Requirement 15.1: Record trackable events with full context.
   */
  @Public()
  @Post('analytics/events')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async trackEvent(@Body() event: TrackEventDto) {
    return this.analyticsService.trackEvent(event);
  }

  /**
   * GET /admin/analytics/users
   * Get aggregated user engagement metrics for a date range.
   * Admin only.
   *
   * Requirement 15.2: Session counts, play time, retention metrics.
   */
  @Get('admin/analytics/users')
  @Roles('ADMIN')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async getUserMetrics(@Query() query: DateRangeDto) {
    return this.analyticsService.getUserMetrics(query);
  }

  /**
   * GET /admin/analytics/games
   * Get game performance metrics for a date range.
   * Admin only.
   *
   * Requirement 15.3: Play counts, avg session duration, revenue per game.
   */
  @Get('admin/analytics/games')
  @Roles('ADMIN')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async getGameMetrics(@Query() query: DateRangeDto) {
    return this.analyticsService.getGameMetrics(query);
  }

  /**
   * GET /admin/analytics/revenue
   * Get revenue metrics for a date range.
   * Admin only.
   *
   * Requirement 15.4: Gross revenue, refunds, net, ad revenue, by source.
   */
  @Get('admin/analytics/revenue')
  @Roles('ADMIN')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async getRevenueMetrics(@Query() query: DateRangeDto) {
    return this.analyticsService.getRevenueMetrics(query);
  }
}
