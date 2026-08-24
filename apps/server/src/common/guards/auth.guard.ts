import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { RequestWithAuth } from "../types/auth.types";

/**
 * Global NestJS guard that enforces user authentication unless a route is explicitly marked with `@Public()`.
 *
 * Evaluation rules:
 * - If the target route handler or controller class has `@Public()`, authentication is skipped and access is granted.
 * - Otherwise, the request must have a valid `req.user` attached by `AuthMiddleware`, or an `UnauthorizedException` is thrown.
 *
 * @example
 * ```typescript
 * // In AppModule as a global guard:
 * providers: [
 *   {
 *     provide: APP_GUARD,
 *     useClass: AuthGuard,
 *   },
 * ]
 * ```
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * Creates an instance of `AuthGuard`.
   *
   * @param reflector - NestJS metadata reflector.
   */
  public constructor(private readonly reflector: Reflector) {}

  /**
   * Evaluates if the current request is authorized to proceed.
   *
   * @param context - NestJS execution context.
   * @returns `true` if public or authenticated, throws `UnauthorizedException` if unauthenticated.
   */
  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If marked as public, skip authentication requirement
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user ?? null;

    if (user === null) {
      throw new UnauthorizedException("Authentication required.");
    }

    return true;
  }
}
