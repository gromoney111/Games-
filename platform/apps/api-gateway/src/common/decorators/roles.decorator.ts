import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access an endpoint.
 * Used with RolesGuard to enforce role-based access control.
 *
 * @example
 * @Roles('admin')
 * @Get('admin/dashboard')
 * getDashboard() { ... }
 *
 * @example
 * @Roles('admin', 'moderator')
 * @Delete('users/:id')
 * deleteUser() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
