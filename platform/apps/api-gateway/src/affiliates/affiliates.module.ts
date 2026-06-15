/**
 * Affiliates Module
 *
 * NestJS module for the affiliate program.
 * Provides affiliate registration, approval workflow,
 * click/conversion tracking, commission calculation,
 * and payout processing.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';
import { AffiliatesRepository } from './affiliates.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AffiliatesController],
  providers: [AffiliatesService, AffiliatesRepository],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
