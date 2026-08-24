import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "@IRIS/cache";
import {
  extractNextAuthCookie,
  verifyNextAuthJwt,
  extractBearerToken,
  hashApiKey,
} from "@IRIS/auth/verify";
import { PrismaService } from "../../providers/prisma.service";
import {
  AuthenticatedUser,
  AuthMethod,
  AuthResolutionResult,
} from "../types/auth.types";

/**
 * Service responsible for resolving and validating authentication credentials across
 * NextAuth session cookies, Bearer tokens, and API keys with Redis/In-Memory caching.
 */
@Injectable()
export class AuthResolverService {
  private readonly logger: Logger = new Logger(AuthResolverService.name);

  /**
   * User profile cache duration in seconds (1 minute).
   */
  private static readonly USER_CACHE_TTL_SECONDS: number = 60;

  /**
   * API Key cache duration in seconds (5 minutes).
   */
  private static readonly API_KEY_CACHE_TTL_SECONDS: number = 300;

  /**
   * Creates an instance of `AuthResolverService`.
   *
   * @param prisma - Prisma database client provider.
   * @param cache - Unified cache manager for Redis and in-memory storage.
   */
  public constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Resolves authentication credentials in strict priority order:
   * 1. NextAuth Session Cookie
   * 2. Bearer / Header Token
   * 3. API Key
   *
   * @param cookieHeader - Raw `Cookie` header string.
   * @param authorizationHeader - Raw `Authorization` header string.
   * @param headers - Complete HTTP headers record.
   * @param queryParams - URL query parameters record.
   * @returns Resolved authentication context with user profile and method, or unauthenticated.
   *
   * @example
   * ```typescript
   * const auth = await authResolver.resolveAuth(
   *   req.headers.cookie,
   *   req.headers.authorization,
   *   req.headers,
   *   req.query,
   * );
   * ```
   */
  public async resolveAuth(
    cookieHeader: string | null | undefined,
    authorizationHeader: string | null | undefined,
    headers: Record<string, string | string[] | undefined>,
    queryParams: Record<string, string | string[] | undefined> = {},
  ): Promise<AuthResolutionResult> {
    // ---------------------------------------------------------
    // Priority 1: NextAuth Session Cookie
    // ---------------------------------------------------------
    const cookieToken = extractNextAuthCookie(cookieHeader);
    if (cookieToken !== null && cookieToken.length > 0) {
      const user = await this.resolveNextAuthCookieToken(cookieToken);
      if (user !== null) {
        return {
          user,
          method: "session",
          apiKeyId: null,
        };
      }
    }

    // ---------------------------------------------------------
    // Priority 2: Bearer / Header Token
    // ---------------------------------------------------------
    const token = this.extractTokenFromRequest(authorizationHeader, headers, queryParams);
    if (token !== null && token.length > 0) {
      const user = await this.resolveToken(token);
      if (user !== null) {
        return {
          user,
          method: "token",
          apiKeyId: null,
        };
      }
    }

    // ---------------------------------------------------------
    // Priority 3: API Key
    // ---------------------------------------------------------
    const apiKey = this.extractApiKeyFromRequest(headers, queryParams);
    if (apiKey !== null && apiKey.length > 0) {
      const apiKeyResult = await this.resolveApiKey(apiKey);
      if (apiKeyResult.user !== null) {
        return {
          user: apiKeyResult.user,
          method: "api_key",
          apiKeyId: apiKeyResult.apiKeyId,
        };
      }
    }

    // Unauthenticated
    return {
      user: null,
      method: "none",
      apiKeyId: null,
    };
  }

  /**
   * Resolves and validates a user from a NextAuth session cookie JWT.
   *
   * @param rawCookieToken - The decrypted/encoded session token string.
   * @returns Authenticated user entity or `null` if invalid or revoked.
   */
  private async resolveNextAuthCookieToken(
    rawCookieToken: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      const jwt = await verifyNextAuthJwt(rawCookieToken);
      if (jwt === null || typeof jwt.id !== "string" || jwt.id.trim().length === 0) {
        return null;
      }

      const user = await this.findUserById(jwt.id);
      if (user === null) {
        return null;
      }

      // Invalidate if user changed password after the token was issued
      if (
        typeof user.passwordChangedAt === "number" &&
        typeof jwt.iat === "number" &&
        jwt.iat < user.passwordChangedAt
      ) {
        this.logger.warn(`Session revoked for user ${user.id}: password changed after token issue.`);
        return null;
      }

      return user;
    } catch (error) {
      this.logger.debug(`Error verifying NextAuth cookie token: ${String(error)}`);
      return null;
    }
  }

  /**
   * Resolves a token from either NextAuth JWT verification or cached session state.
   *
   * @param rawToken - The raw token string.
   * @returns Authenticated user entity or `null`.
   */
  private async resolveToken(rawToken: string): Promise<AuthenticatedUser | null> {
    // 1. Try decoding as NextAuth JWT
    const jwtUser = await this.resolveNextAuthCookieToken(rawToken);
    if (jwtUser !== null) {
      return jwtUser;
    }

    // 2. Try looking up in cache session store (e.g. iris:auth:token:<token> or iris:login_code:session:<token>)
    const cachedUserId = await this.cache.get<string>(`iris:auth:token:${rawToken}`);
    if (cachedUserId !== null && cachedUserId.length > 0) {
      return this.findUserById(cachedUserId);
    }

    return null;
  }

  /**
   * Resolves an API key by checking cache first, then Prisma database with SHA-256 hash lookup.
   *
   * @param rawApiKey - Plaintext API key string.
   * @returns Object containing user entity and API key ID if valid.
   */
  private async resolveApiKey(
    rawApiKey: string,
  ): Promise<{ readonly user: AuthenticatedUser | null; readonly apiKeyId: string | null }> {
    const keyHash = hashApiKey(rawApiKey);

    // 1. Check cached API key lookup
    interface CachedApiKey {
      readonly id: string;
      readonly userId: string;
      readonly expiresAt: number | null;
    }

    let cached = await this.cache.get<CachedApiKey>(`iris:auth:apikey:${keyHash}`);

    if (cached === null) {
      const dbKey = await this.prisma.apiKey.findFirst({
        where: { hash: keyHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
        },
      });

      if (dbKey === null) {
        return { user: null, apiKeyId: null };
      }

      const expiresAtTimestamp = dbKey.expiresAt ? dbKey.expiresAt.getTime() : null;
      cached = {
        id: dbKey.id,
        userId: dbKey.userId,
        expiresAt: expiresAtTimestamp,
      };

      await this.cache.set(
        `iris:auth:apikey:${keyHash}`,
        cached,
        AuthResolverService.API_KEY_CACHE_TTL_SECONDS,
      );
    }

    // Check expiration
    if (cached.expiresAt !== null && Date.now() > cached.expiresAt) {
      this.logger.warn(`API key ${cached.id} has expired.`);
      return { user: null, apiKeyId: null };
    }

    // Asynchronously update lastUsedAt without blocking the request
    void this.updateApiKeyLastUsed(cached.id);

    const user = await this.findUserById(cached.userId);
    return {
      user,
      apiKeyId: cached.id,
    };
  }

  /**
   * Retrieves user profile and permissions from cache or Prisma database.
   *
   * @param userId - Unique user UUID.
   * @returns Authenticated user entity or `null`.
   */
  public async findUserById(userId: string): Promise<AuthenticatedUser | null> {
    const cacheKey = `iris:auth:user:${userId}`;
    const cachedUser = await this.cache.get<AuthenticatedUser>(cacheKey);
    if (cachedUser !== null) {
      return cachedUser;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        permissions: true,
        passwordChangedAt: true,
      },
    });

    if (dbUser === null) {
      return null;
    }

    const passwordChangedAtSeconds = dbUser.passwordChangedAt
      ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
      : null;

    const user: AuthenticatedUser = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      permissions: dbUser.permissions,
      passwordChangedAt: passwordChangedAtSeconds,
    };

    await this.cache.set(
      cacheKey,
      user,
      AuthResolverService.USER_CACHE_TTL_SECONDS,
    );

    return user;
  }

  /**
   * Extracts a token from HTTP headers or query parameters.
   *
   * @param authorizationHeader - Authorization header value.
   * @param headers - HTTP request headers.
   * @param queryParams - URL query parameters.
   * @returns Token string or `null`.
   */
  private extractTokenFromRequest(
    authorizationHeader: string | null | undefined,
    headers: Record<string, string | string[] | undefined>,
    queryParams: Record<string, string | string[] | undefined>,
  ): string | null {
    // 1. Authorization: Bearer <token>
    const bearer = extractBearerToken(authorizationHeader);
    if (bearer !== null && bearer.length > 0) {
      return bearer;
    }

    // 2. x-auth-token header
    const xAuthToken = headers["x-auth-token"];
    if (typeof xAuthToken === "string" && xAuthToken.trim().length > 0) {
      return xAuthToken.trim();
    }

    // 3. x-token header
    const xToken = headers["x-token"];
    if (typeof xToken === "string" && xToken.trim().length > 0) {
      return xToken.trim();
    }

    // 4. token query param
    const queryToken = queryParams["token"];
    if (typeof queryToken === "string" && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    return null;
  }

  /**
   * Extracts an API key from HTTP headers or query parameters.
   *
   * @param headers - HTTP request headers.
   * @param queryParams - URL query parameters.
   * @returns API key string or `null`.
   */
  private extractApiKeyFromRequest(
    headers: Record<string, string | string[] | undefined>,
    queryParams: Record<string, string | string[] | undefined>,
  ): string | null {
    // 1. x-api-key header
    const xApiKey = headers["x-api-key"];
    if (typeof xApiKey === "string" && xApiKey.trim().length > 0) {
      return xApiKey.trim();
    }

    // 2. apiKey header
    const apiKeyHeader = headers["apikey"];
    if (typeof apiKeyHeader === "string" && apiKeyHeader.trim().length > 0) {
      return apiKeyHeader.trim();
    }

    // 3. Authorization: ApiKey <key>
    const authHeader = headers["authorization"];
    if (typeof authHeader === "string" && authHeader.trim().startsWith("ApiKey ")) {
      const key = authHeader.trim().slice(7).trim();
      if (key.length > 0) {
        return key;
      }
    }

    // 4. Query param api_key or apiKey
    const queryApiKey = queryParams["api_key"] ?? queryParams["apiKey"];
    if (typeof queryApiKey === "string" && queryApiKey.trim().length > 0) {
      return queryApiKey.trim();
    }

    return null;
  }

  /**
   * Updates the `lastUsedAt` timestamp of an API key asynchronously.
   *
   * @param apiKeyId - API key UUID.
   */
  private async updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
    try {
      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Non-critical background update failure
    }
  }
}
