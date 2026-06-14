/**
 * Sessions Module
 *
 * NestJS module for game session management.
 * Provides session lifecycle services, repository, and controller.
 * Configures Redis cache client for session state and analytics publisher.
 *
 * Dependencies:
 * - PrismaModule for database access
 * - Redis for session state cache
 * - Analytics publisher (message queue) for game events
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsController } from './sessions.controller';
import { SessionsService, SESSION_CACHE_CLIENT, ANALYTICS_PUBLISHER, USER_LOOKUP, GAME_LOOKUP } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Factory provider for the Redis session cache client.
 * Falls back to a no-op client for development without Redis.
 */
const SessionCacheClientProvider = {
  provide: SESSION_CACHE_CLIENT,
  useFactory: (configService: ConfigService) => {
    try {
      const Redis = require('ioredis');
      const host = configService.get<string>('app.redis.host', 'localhost');
      const port = configService.get<number>('app.redis.port', 6379);
      const password = configService.get<string>('app.redis.password', '');

      const client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        keyPrefix: 'gaming:',
      });

      client.on('error', (err: Error) => {
        console.error('[Redis/SessionCache] Connection error:', err.message);
      });

      return client;
    } catch {
      // Return a stub client if ioredis is not available (development fallback)
      console.warn('[Redis/SessionCache] ioredis not available, session caching disabled');
      return {
        get: async () => null,
        setex: async () => 'OK',
        del: async () => 0,
      };
    }
  },
  inject: [ConfigService],
};

/**
 * Factory provider for the analytics event publisher.
 * In production this would connect to RabbitMQ/SQS.
 * For now provides a no-op publisher that logs events.
 */
const AnalyticsPublisherProvider = {
  provide: ANALYTICS_PUBLISHER,
  useFactory: () => ({
    publish: async (queue: string, event: any) => {
      // In production: publish to RabbitMQ/SQS
      // For now, just log (events are fire-and-forget)
      console.log(`[Analytics] ${queue}:`, event.eventType, event.payload?.sessionId || '');
    },
  }),
};

/**
 * Factory provider for user lookup (reads from Prisma).
 */
const UserLookupProvider = {
  provide: USER_LOOKUP,
  useFactory: (prisma: PrismaService) => ({
    findById: async (userId: string) => {
      return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
      });
    },
  }),
  inject: [PrismaService],
};

/**
 * Factory provider for game lookup (reads from Prisma).
 */
const GameLookupProvider = {
  provide: GAME_LOOKUP,
  useFactory: (prisma: PrismaService) => ({
    findById: async (gameId: string) => {
      return prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, status: true, config: true },
      });
    },
  }),
  inject: [PrismaService],
};

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionsRepository,
    SessionCacheClientProvider,
    AnalyticsPublisherProvider,
    UserLookupProvider,
    GameLookupProvider,
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
