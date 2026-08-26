import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { decode, type JWT } from "next-auth/jwt";
import { prisma as defaultPrisma } from "@IRIS/database";
import { IRISBitField, type IRISBitFieldResolvable } from "@IRIS/permissions";

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  permissions: number[];
}

export type SessionStatus = "authenticated" | "unauthenticated";
export type AuthMethod = "session" | "token" | "api_key" | "none";

export interface SessionInitData {
  user: SessionUser | null;
  method: AuthMethod;
  token?: string | null;
  apiKeyId?: string | null;
}

/**
 * Rich Session object representing the current request's authentication state.
 */
export class Session {
  /**
   * Authentication status: "authenticated" or "unauthenticated".
   */
  public readonly status: SessionStatus;

  /**
   * Authenticated user entity, or null if unauthenticated.
   */
  public readonly user: SessionUser | null;

  /**
   * Authentication mechanism used: "session", "token", "api_key", or "none".
   */
  public readonly method: AuthMethod;

  /**
   * Token string if authenticated via cookie or bearer token.
   */
  public readonly token: string | null;

  /**
   * API key ID if authenticated via API key.
   */
  public readonly apiKeyId: string | null;

  constructor(data?: SessionInitData | null) {
    this.user = data?.user ?? null;
    this.method = data?.method ?? "none";
    this.token = data?.token ?? null;
    this.apiKeyId = data?.apiKeyId ?? null;
    this.status = this.user !== null ? "authenticated" : "unauthenticated";
  }

  /**
   * Whether the request has a valid authenticated session.
   */
  public get isAuthenticated(): boolean {
    return this.status === "authenticated";
  }

  /**
   * Retrieves the authenticated user profile, or null if unauthenticated.
   */
  public getUser(): SessionUser | null {
    return this.user;
  }

  /**
   * Returns the authenticated user or throws an unauthorized error.
   */
  public requireUser(): SessionUser {
    if (!this.user) {
      throw new Error("Unauthorized: Session is unauthenticated");
    }
    return this.user;
  }

  /**
   * Verifies if the authenticated user has the specified permission(s).
   * Automatically grants access if user possesses ADMINISTRATOR permission.
   */
  public hasPermission(permission: IRISBitFieldResolvable | number): boolean {
    if (!this.user || !this.user.permissions) {
      return false;
    }
    const bitfield = new IRISBitField(this.user.permissions);
    const resolvable =
      typeof permission === "number" ? BigInt(permission) : permission;
    return bitfield.has(resolvable as IRISBitFieldResolvable);
  }
}

export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

export function parseCookieHeader(
  cookieHeader: string | null | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || cookieHeader.trim().length === 0) return result;

  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    if (trimmed.length === 0) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const rawVal = trimmed.slice(sep + 1).trim();
    if (key.length === 0) continue;
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

export function extractNextAuthCookie(
  cookieHeader: string | Record<string, string> | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const cookies =
    typeof cookieHeader === "string"
      ? parseCookieHeader(cookieHeader)
      : cookieHeader;

  for (const base of NEXTAUTH_SESSION_COOKIE_NAMES) {
    const direct = cookies[base];
    if (direct && direct.length > 0) return direct;

    const chunk0 = cookies[`${base}.0`];
    if (chunk0 && chunk0.length > 0) {
      let assembled = chunk0;
      let i = 1;
      while (cookies[`${base}.${i}`] !== undefined) {
        assembled += cookies[`${base}.${i}`];
        i++;
      }
      return assembled;
    }
  }
  return null;
}

export async function verifyNextAuthJwt(
  rawToken: string | null | undefined,
  secret: string | null | undefined = process.env.NEXTAUTH_SECRET,
): Promise<JWT | null> {
  if (!rawToken || rawToken.trim().length === 0) return null;
  const effectiveSecret = secret ?? process.env.NEXTAUTH_SECRET;
  if (!effectiveSecret) return null;

  try {
    const decoded = await decode({
      token: rawToken.trim(),
      secret: effectiveSecret,
    });
    if (!decoded || typeof decoded !== "object") return null;
    return decoded as JWT;
  } catch {
    return null;
  }
}

export function extractBearerToken(
  authorizationHeader: string | null | undefined,
): string | null {
  if (!authorizationHeader || authorizationHeader.trim().length === 0) {
    return null;
  }
  const parts = authorizationHeader.trim().split(" ");
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] ?? null;
  }
  if (parts.length === 1 && parts[0] && !parts[0].includes(" ")) {
    return parts[0];
  }
  return null;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey.trim()).digest("hex");
}

type DatabaseClient = typeof defaultPrisma;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const USER_CACHE_TTL_MS = 60 * 1000; // 1 minute
const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const userCache = new Map<string, CacheEntry<SessionUser | null>>();
const apiKeyCache = new Map<string, CacheEntry<{ id: string; userId: string; expiresAt: number | null } | null>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  if (cache.size > 2000) {
    cache.clear();
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Fetches a user by ID from cache or database.
 */
async function findUserById(
  userId: string,
  prisma: DatabaseClient,
): Promise<SessionUser | null> {
  const cached = getCached(userCache, userId);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        permissions: true,
        passwordChangedAt: true,
      },
    });

    if (!dbUser) {
      setCached(userCache, userId, null, USER_CACHE_TTL_MS);
      return null;
    }

    const user: SessionUser = {
      id: dbUser.id,
      username: dbUser.username.trim(),
      email: dbUser.email,
      permissions: dbUser.permissions,
    };

    setCached(userCache, userId, user, USER_CACHE_TTL_MS);
    return user;
  } catch {
    return null;
  }
}

export interface AuthErrorResponse {
  readonly status: 401 | 404;
  readonly error: "Unauthorized" | "Not Found";
  readonly message: "Session expired" | "API key not found" | "User not found";
}

export interface ResolveSessionResult {
  readonly sessionData: SessionInitData | null;
  readonly error: AuthErrorResponse | null;
}

/**
 * Extracts session in strict priority order:
 * 1. NextAuth Session Cookie
 * 2. Bearer / Header Token
 * 3. API Key
 *
 * If credentials are provided but invalid, expired, or non-existent,
 * returns an appropriate error (404 "Not Found" or 401 "Session expired").
 */
export async function resolveSessionFromRequest(
  request: Request,
  prisma: DatabaseClient = defaultPrisma,
): Promise<ResolveSessionResult> {
  const url = new URL(request.url);

  // ---------------------------------------------------------
  // Priority 1: NextAuth Session Cookie
  // ---------------------------------------------------------
  const cookieHeader = request.headers.get("cookie");
  const cookieToken = extractNextAuthCookie(cookieHeader);

  if (cookieToken !== null && cookieToken.trim().length > 0) {
    let jwt: JWT | null = null;
    try {
      jwt = await verifyNextAuthJwt(cookieToken);
    } catch {
      jwt = null;
    }

    if (!jwt || typeof jwt.id !== "string" || jwt.id.trim().length === 0) {
      return {
        sessionData: null,
        error: {
          status: 401,
          error: "Unauthorized",
          message: "Session expired",
        },
      };
    }

    const user = await findUserById(jwt.id, prisma);
    if (!user) {
      return {
        sessionData: null,
        error: {
          status: 404,
          error: "Not Found",
          message: "User not found",
        },
      };
    }

    // Verify if password was changed after token was issued
    const dbUser = await prisma.user.findUnique({
      where: { id: jwt.id },
      select: { passwordChangedAt: true },
    });

    const pwdChangedSeconds = dbUser?.passwordChangedAt
      ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
      : null;

    if (
      pwdChangedSeconds !== null &&
      typeof jwt.iat === "number" &&
      jwt.iat < pwdChangedSeconds
    ) {
      return {
        sessionData: null,
        error: {
          status: 401,
          error: "Unauthorized",
          message: "Session expired",
        },
      };
    }

    return {
      sessionData: {
        user,
        method: "session",
        token: cookieToken,
      },
      error: null,
    };
  }

  // ---------------------------------------------------------
  // Priority 2: Bearer / Header Token
  // ---------------------------------------------------------
  const authHeader = request.headers.get("authorization");
  const bearerToken =
    extractBearerToken(authHeader) ??
    request.headers.get("x-auth-token")?.trim() ??
    request.headers.get("x-token")?.trim() ??
    url.searchParams.get("token")?.trim() ??
    null;

  if (bearerToken !== null && bearerToken.length > 0) {
    let jwt: JWT | null = null;
    try {
      jwt = await verifyNextAuthJwt(bearerToken);
    } catch {
      jwt = null;
    }

    if (!jwt || typeof jwt.id !== "string" || jwt.id.trim().length === 0) {
      return {
        sessionData: null,
        error: {
          status: 401,
          error: "Unauthorized",
          message: "Session expired",
        },
      };
    }

    const user = await findUserById(jwt.id, prisma);
    if (!user) {
      return {
        sessionData: null,
        error: {
          status: 404,
          error: "Not Found",
          message: "User not found",
        },
      };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: jwt.id },
      select: { passwordChangedAt: true },
    });

    const pwdChangedSeconds = dbUser?.passwordChangedAt
      ? Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
      : null;

    if (
      pwdChangedSeconds !== null &&
      typeof jwt.iat === "number" &&
      jwt.iat < pwdChangedSeconds
    ) {
      return {
        sessionData: null,
        error: {
          status: 401,
          error: "Unauthorized",
          message: "Session expired",
        },
      };
    }

    return {
      sessionData: {
        user,
        method: "token",
        token: bearerToken,
      },
      error: null,
    };
  }

  // ---------------------------------------------------------
  // Priority 3: API Key
  // ---------------------------------------------------------
  let rawApiKey: string | null = null;
  const xApiKey = request.headers.get("x-api-key");
  const apiKeyHeader = request.headers.get("apikey");

  if (xApiKey && xApiKey.trim().length > 0) {
    rawApiKey = xApiKey.trim();
  } else if (apiKeyHeader && apiKeyHeader.trim().length > 0) {
    rawApiKey = apiKeyHeader.trim();
  } else if (authHeader && authHeader.trim().startsWith("ApiKey ")) {
    rawApiKey = authHeader.trim().slice(7).trim();
  } else {
    const queryKey = url.searchParams.get("api_key") ?? url.searchParams.get("apiKey");
    if (queryKey && queryKey.trim().length > 0) {
      rawApiKey = queryKey.trim();
    }
  }

  if (rawApiKey !== null && rawApiKey.length > 0) {
    const keyHash = hashApiKey(rawApiKey);
    const cachedKey = getCached(apiKeyCache, keyHash);

    let keyRecord = cachedKey;
    if (keyRecord === undefined) {
      let dbKey: { id: string; userId: string; expiresAt: Date | null } | null = null;
      try {
        dbKey = await prisma.apiKey.findFirst({
          where: { hash: keyHash },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
          },
        });
      } catch {
        dbKey = null;
      }

      if (!dbKey) {
        setCached(apiKeyCache, keyHash, null, API_KEY_CACHE_TTL_MS);
        return {
          sessionData: null,
          error: {
            status: 404,
            error: "Not Found",
            message: "API key not found",
          },
        };
      }

      keyRecord = {
        id: dbKey.id,
        userId: dbKey.userId,
        expiresAt: dbKey.expiresAt ? dbKey.expiresAt.getTime() : null,
      };
      setCached(apiKeyCache, keyHash, keyRecord, API_KEY_CACHE_TTL_MS);
    }

    if (!keyRecord) {
      return {
        sessionData: null,
        error: {
          status: 404,
          error: "Not Found",
          message: "API key not found",
        },
      };
    }

    // Check expiration
    if (keyRecord.expiresAt !== null && Date.now() > keyRecord.expiresAt) {
      return {
        sessionData: null,
        error: {
          status: 401,
          error: "Unauthorized",
          message: "Session expired",
        },
      };
    }

    // Asynchronously update lastUsedAt
    prisma.apiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    const user = await findUserById(keyRecord.userId, prisma);
    if (!user) {
      return {
        sessionData: null,
        error: {
          status: 404,
          error: "Not Found",
          message: "User not found",
        },
      };
    }

    return {
      sessionData: {
        user,
        method: "api_key",
        apiKeyId: keyRecord.id,
      },
      error: null,
    };
  }

  // ---------------------------------------------------------
  // Fallback: No credentials provided
  // ---------------------------------------------------------
  return {
    sessionData: null,
    error: null,
  };
}

/**
 * Elysia plugin that automatically resolves and extracts session context on every request.
 * Evaluates credentials in priority order:
 * 1. NextAuth session cookie
 * 2. Bearer / header token
 * 3. API key
 *
 * If credentials are provided but invalid or expired, rejects the request immediately:
 * - 404 "API key not found" / "User not found"
 * - 401 "Session expired"
 *
 * Injects `session` instance into the route context.
 */
export const session = (options?: { prisma?: DatabaseClient }) =>
  new Elysia({ name: "iris-session" })
    .derive("global", async ({ request }) => {
      const { sessionData, error } = await resolveSessionFromRequest(
        request,
        options?.prisma ?? defaultPrisma,
      );

      return {
        session: new Session(sessionData),
        authError: error,
      };
    })
    .beforeHandle("global", ({ authError, set }) => {
      if (authError) {
        set.status = authError.status;
        return authError;
      }
    });
