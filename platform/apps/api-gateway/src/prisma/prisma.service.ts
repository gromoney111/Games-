/**
 * Prisma Service
 *
 * NestJS-injectable Prisma client service. Handles connection lifecycle
 * (onModuleInit, onModuleDestroy) for the application.
 *
 * Note: Full Prisma Client generation requires running `npx prisma generate`
 * after the database schema is set up (Task 1.3). For now, this provides
 * the interface that other modules depend on.
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // Placeholder properties that will be replaced with PrismaClient extension
  // once `npx prisma generate` is run with the schema
  user: any;
  userProfile: any;
  game: any;
  gameSession: any;
  transaction: any;
  affiliate: any;

  async onModuleInit() {
    this.logger.log('Prisma service initialized (placeholder mode)');
    // await this.$connect(); // Enable when schema is generated
  }

  async onModuleDestroy() {
    this.logger.log('Prisma service destroyed');
    // await this.$disconnect(); // Enable when schema is generated
  }
}
