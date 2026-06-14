/**
 * Users Module
 *
 * NestJS module providing user-related services, repository, and controller.
 * Exports UsersService for use in other modules (e.g., Auth).
 * Provides Redis cache client for profile caching.
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService, CACHE_CLIENT } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Factory provider for the Redis cache client used by UsersService.
 * Falls back to a no-op client for development without Redis.
 */
const CacheClientProvider = {
  provide: CACHE_CLIENT,
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
        console.error('[Redis/UserCache] Connection error:', err.message);
      });

      return client;
    } catch {
      // Return a stub client if ioredis is not available (development fallback)
      console.warn('[Redis/UserCache] ioredis not available, caching disabled');
      return {
        get: async () => null,
        set: async () => 'OK',
        setex: async () => 'OK',
        del: async () => 0,
      };
    }
  },
  inject: [ConfigService],
};

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, CacheClientProvider],
  exports: [UsersService],
})
export class UsersModule {}
