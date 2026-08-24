import { Injectable, NestMiddleware } from "@nestjs/common";
import { Response, NextFunction } from "express";
import { AuthResolverService } from "../services/auth-resolver.service";
import { RequestWithAuth } from "../types/auth.types";

/**
 * Global authentication middleware for NestJS HTTP requests.
 *
 * Evaluates incoming credentials in sequential priority:
 * 1. **NextAuth Session Cookie** (`__Secure-next-auth.session-token` / `next-auth.session-token` + chunked cookies)
 * 2. **Bearer / Header Token** (`Authorization: Bearer <token>`, `x-auth-token`, `x-token`, query `token`)
 * 3. **API Key** (`x-api-key`, `Authorization: ApiKey <key>`, `apiKey`, query `api_key` / `apiKey`)
 *
 * Populates `req.user` with the resolved `AuthenticatedUser` and `req.authMethod` with the active method,
 * then passes execution to the next middleware or route handler.
 *
 * @example
 * ```typescript
 * // In AppModule
 * export class AppModule implements NestModule {
 *   public configure(consumer: MiddlewareConsumer): void {
 *     consumer.apply(AuthMiddleware).forRoutes("*");
 *   }
 * }
 * ```
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  /**
   * Creates an instance of `AuthMiddleware`.
   *
   * @param authResolver - Service resolving credentials to user entities.
   */
  public constructor(private readonly authResolver: AuthResolverService) {}

  /**
   * Processes the incoming HTTP request, attempts authentication, and attaches user context.
   *
   * @param req - Incoming HTTP request with authentication extensions.
   * @param _res - HTTP response object.
   * @param next - Next middleware callback function.
   */
  public async use(
    req: RequestWithAuth,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const cookieHeader = req.headers.cookie ?? null;
    const authHeader = req.headers.authorization ?? null;
    const queryParams: Record<string, string | string[] | undefined> = {};

    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string" || Array.isArray(value)) {
        queryParams[key] = value as string | string[];
      }
    }

    const result = await this.authResolver.resolveAuth(
      cookieHeader,
      authHeader,
      req.headers,
      queryParams,
    );

    req.user = result.user;
    req.authMethod = result.method;
    req.apiKeyId = result.apiKeyId ?? null;

    next();
  }
}
