import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import appConfig from './config/app.config';

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

    // Feature modules (placeholders - will be added in later tasks)
    // GamesModule,
    // PaymentsModule,
    // AffiliatesModule,
    // AdsModule,
    // AnalyticsModule,
    // AdminModule,
  ],
  providers: [
    // Global JWT auth guard (applied to all routes unless @Public() is used)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
