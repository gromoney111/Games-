/**
 * Users Module
 *
 * NestJS module providing user-related services and repository.
 * Exports UsersService for use in other modules (e.g., Auth).
 */

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
