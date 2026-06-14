/**
 * Auth Module
 *
 * NestJS module for authentication features.
 * Provides registration, login, and token management.
 */

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, CryptoService],
  exports: [AuthService, CryptoService],
})
export class AuthModule {}
