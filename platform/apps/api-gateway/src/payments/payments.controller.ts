/**
 * Payments Controller
 *
 * Handles in-app purchase endpoints:
 * - POST /purchases/initiate - Initiate a purchase with eligibility validation
 * - POST /purchases/:id/refund - Refund a completed transaction
 * - GET /purchases/history - Get paginated transaction history
 * - POST /purchases/webhooks/stripe - Handle Stripe webhook events
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiatePurchaseDto } from './dto/initiate-purchase.dto';
import { RefundDto } from './dto/refund.dto';
import { PaginationDto } from './dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { WebhookProvider } from '../common/decorators/webhook.decorator';
import { WebhookSignatureGuard } from '../common/guards/webhook-signature.guard';
import { RequestUser } from '../common/guards/jwt-auth.guard';

@Controller('purchases')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /purchases/initiate
   *
   * Initiates an in-app purchase. Validates:
   * - Active account status
   * - Item existence
   * - Age restriction
   * - Daily purchase limit (50/day rolling 24h)
   * - Amount validity ($0.01-$9,999.99)
   * - Stock availability
   *
   * Creates a Stripe payment intent and records a pending transaction.
   * Returns transaction ID and Stripe client secret for frontend to complete payment.
   */
  @Post('initiate')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async initiatePurchase(
    @Body() dto: InitiatePurchaseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.initiatePurchase(user.userId, dto);
  }

  /**
   * POST /purchases/:id/refund
   *
   * Refunds a completed transaction. Validates that refund amount
   * does not exceed the original transaction amount.
   */
  @Post(':id/refund')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.refund(id, dto, user.userId);
  }

  /**
   * GET /purchases/history
   *
   * Returns paginated transaction history for the authenticated user.
   */
  @Get('history')
  async getHistory(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationDto,
  ) {
    return this.paymentsService.getTransactionHistory(user.userId, query);
  }

  /**
   * POST /purchases/webhooks/stripe
   *
   * Handles Stripe webhook events (payment_intent.succeeded, payment_intent.payment_failed).
   * Public endpoint (no JWT required) but protected by webhook signature validation.
   */
  @Post('webhooks/stripe')
  @Public()
  @UseGuards(WebhookSignatureGuard)
  @WebhookProvider('stripe')
  async handleStripeWebhook(@Body() payload: any, @Req() req: any) {
    return this.paymentsService.handleWebhook(payload, req.rawBody);
  }
}
