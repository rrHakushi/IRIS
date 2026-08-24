import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser, RequestWithAuth } from "../types/auth.types";

/**
 * Route parameter decorator that extracts the authenticated `AuthenticatedUser` object
 * or a specific user property from the incoming HTTP request.
 *
 * @param data - Optional specific property key to extract from `AuthenticatedUser`.
 * @param ctx - NestJS execution context.
 * @returns The `AuthenticatedUser` object, the requested property value, or `null`.
 *
 * @example
 * ```typescript
 * // Extract the full user object
 * @Get("profile")
 * public getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * // Extract a specific property
 * @Get("id")
 * public getUserId(@CurrentUser("id") userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator<keyof AuthenticatedUser | undefined>(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | string | readonly number[] | number | null => {
  const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
  const user = request.user ?? null;

  if (user === null) {
    return null;
  }

  if (data !== undefined) {
    return user[data] ?? null;
  }

  return user;
});

/**
 * Shorthand alias for `@CurrentUser()`.
 */
export const User = CurrentUser;
