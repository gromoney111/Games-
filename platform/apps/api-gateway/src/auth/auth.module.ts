/**
 * Auth Module
 *
 * NestJS module for authentication features.
 * Provides registration, login, token management, and account lockout.
 */

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { JwtService } from './jwt.service';
import { RedisService } from './redis.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, JwtService, RedisService],
  exports: [AuthService, CryptoService, JwtService, RedisService],
})
export class AuthModule {}
