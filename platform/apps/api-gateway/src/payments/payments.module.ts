/**
 * Payments Module
 *
 * NestJS module for in-app purchase processing.
 * Provides purchase initiation with eligibility validation,
 * Stripe payment integration, refunds, and transaction history.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { StripeService } from './stripe.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, StripeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
