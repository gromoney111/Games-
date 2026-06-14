import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../guards/jwt-auth.guard';

/**
 * Parameter decorator to extract the current authenticated user from the request.
 * The user is attached to the request by the JwtAuthGuard after token validation.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: RequestUser) {
 *   return this.userService.getProfile(user.userId);
 * }
 *
 * @example
 * @Get('profile')
 * getUserId(@CurrentUser('userId') userId: string) {
 *   return this.userService.getProfile(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
