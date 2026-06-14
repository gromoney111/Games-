import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { SessionsModule } from './sessions/sessions.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard, REDIS_CLIENT } from './common/guards/rate-limit.guard';
import appConfig from './config/app.config';

/**
 * Factory provider for the Redis client used by the rate limiter.
 * Creates an ioredis-compatible client from application configuration.
 */
const RedisClientProvider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) => {
    // Lazy import to avoid issues if ioredis is not yet installed
    // Falls back to a no-op client for development without Redis
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
      });

      client.on('error', (err: Error) => {
        console.error('[Redis] Connection error:', err.message);
      });

      return client;
    } catch {
      // Return a stub client if ioredis is not available (development fallback)
      console.warn(
        '[Redis] ioredis not available, rate limiting disabled',
      );
      return {
        zremrangebyscore: async () => 0,
        zcard: async () => 0,
        zrange: async () => [],
        zadd: async () => 0,
        expire: async () => 0,
      };
    }
  },
  inject: [ConfigService],
};

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Infrastructure modules
    PrismaModule,

    // Core modules
    AuthModule,
    UsersModule,
    HealthModule,

    // Feature modules
    GamesModule,
    SessionsModule,
    LeaderboardModule,
    // PaymentsModule,
    // AffiliatesModule,
    // AdsModule,
    // AnalyticsModule,
    // AdminModule,
  ],
  providers: [
    // Redis client for rate limiting
    RedisClientProvider,

    // Global JWT auth guard (applied to all routes unless @Public() is used)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limit guard (applied after JWT auth, skips @Public() and @SkipRateLimit() routes)
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
