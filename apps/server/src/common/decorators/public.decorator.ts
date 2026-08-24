import { CustomDecorator, SetMetadata } from "@nestjs/common";

/**
 * Metadata key used to mark route handlers and controllers as publicly accessible.
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a controller class or individual route handler as publicly accessible,
 * skipping mandatory user authentication checks in `AuthGuard`.
 *
 * Even when a route is public, the `AuthMiddleware` still attempts to populate
 * `req.user` if valid credentials (session cookie, token, or API key) are supplied.
 *
 * @returns CustomDecorator marking the target as public.
 *
 * @example
 * ```typescript
 * @Public()
 * @TypedRoute.Post("login")
 * public async login(@TypedBody() body: ILoginRequest) {
 *   return this.authService.login(body);
 * }
 * ```
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Shorthand alias for `@Public()`.
 */
export const IsPublic = Public;
