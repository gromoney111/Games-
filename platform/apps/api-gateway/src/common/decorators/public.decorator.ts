import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark an endpoint as publicly accessible (no JWT auth required).
 * Routes decorated with @Public() will bypass the global JwtAuthGuard.
 *
 * @example
 * @Public()
 * @Post('auth/login')
 * login(@Body() dto: LoginDto) { ... }
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
