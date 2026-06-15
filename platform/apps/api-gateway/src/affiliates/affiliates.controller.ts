/**
 * Affiliates Controller
 *
 * Handles affiliate program endpoints:
 * - GET /r/:trackingCode - Public redirect endpoint for click tracking (302)
 * - POST /affiliates/apply - Register as an affiliate
 * - GET /affiliates/me - Get affiliate dashboard
 * - GET /affiliates/me/earnings - Get earnings report
 * - POST /affiliates/me/links - Generate tracking link for a game
 * - POST /affiliates/me/payout - Request payout ($50 minimum)
 * - PATCH /admin/affiliates/:id/status - Admin approve/reject affiliate
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.5
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { AffiliatesService } from './affiliates.service';
import { AffiliateApplicationDto } from './dto/affiliate-application.dto';
import { GenerateLinkDto } from './dto/generate-link.dto';
import { UpdateAffiliateStatusDto } from './dto/update-affiliate-status.dto';
import { DateRangeDto } from './dto/date-range.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/guards/jwt-auth.guard';

@Controller()
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  /**
   * GET /r/:trackingCode
   *
   * Public redirect endpoint for affiliate click tracking.
   * Records click metadata (IP, user agent, referrer) and redirects
   * to the appropriate game page or homepage with 302 status.
   * If tracking code is invalid or affiliate is inactive, redirects to homepage.
   *
   * Requirements: 9.3
   */
  @Public()
  @Get('r/:trackingCode')
  async trackClick(
    @Param('trackingCode') trackingCode: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.affiliatesService.trackClick(trackingCode, req);
    return res.redirect(302, result.url);
  }

  /**
   * POST /affiliates/apply
   *
   * Submit an affiliate application. Creates a PENDING application
   * with a unique tracking code. Requires authentication.
   *
   * Requirements: 9.1
   */
  @Post('affiliates/apply')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async apply(
    @Body() dto: AffiliateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.affiliatesService.apply(user.userId, dto);
  }

  /**
   * GET /affiliates/me
   *
   * Get the authenticated user's affiliate details/dashboard.
   *
   * Requirements: 9.1
   */
  @Get('affiliates/me')
  async getMyAffiliate(@CurrentUser() user: RequestUser) {
    return this.affiliatesService.getAffiliateByUserId(user.userId);
  }

  /**
   * GET /affiliates/me/earnings
   *
   * Get earnings report for the authenticated affiliate.
   * Accepts optional startDate and endDate query parameters.
   *
   * Requirements: 9.4
   */
  @Get('affiliates/me/earnings')
  async getEarnings(
    @CurrentUser() user: RequestUser,
    @Query() query: DateRangeDto,
  ) {
    return this.affiliatesService.getEarnings(user.userId, query);
  }

  /**
   * POST /affiliates/me/links
   *
   * Generate a tracking link for a specific game.
   * Requires the affiliate to be in ACTIVE status.
   *
   * Requirements: 9.2
   */
  @Post('affiliates/me/links')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async generateLink(
    @Body() dto: GenerateLinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.affiliatesService.generateTrackingLink(user.userId, dto.gameId);
  }

  /**
   * POST /affiliates/me/payout
   *
   * Request a payout of pending earnings.
   * Enforces $50 minimum payout threshold.
   *
   * Requirements: 10.5
   */
  @Post('affiliates/me/payout')
  async requestPayout(@CurrentUser() user: RequestUser) {
    return this.affiliatesService.requestPayout(user.userId);
  }

  /**
   * PATCH /admin/affiliates/:id/status
   *
   * Admin endpoint to approve, reject, suspend, or ban an affiliate.
   * Restricted to ADMIN role.
   *
   * Requirements: 9.1
   */
  @Patch('admin/affiliates/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateStatusDto,
  ) {
    return this.affiliatesService.updateAffiliateStatus(id, dto);
  }
}
