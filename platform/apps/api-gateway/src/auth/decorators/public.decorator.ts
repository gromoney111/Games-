/**
 * Public Decorator
 *
 * Marks a route as public, bypassing JWT authentication.
 * Used for routes like registration and login that don't require auth.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
