import { createHash } from "node:crypto";
import { decode, JWT } from "next-auth/jwt";

/**
 * Cookie names used by NextAuth to store session JWTs.
 */
export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

/**
 * Parses a raw HTTP `Cookie` header string into a key-value record of strings.
 *
 * @param cookieHeader - The raw `Cookie` header string received in HTTP request headers.
 * @returns A strictly-typed record mapping cookie names to their decoded string values.
 *
 * @example
 * ```typescript
 * const cookies = parseCookieHeader("next-auth.session-token=abc.def.ghi; theme=dark");
 * console.log(cookies["next-auth.session-token"]); // "abc.def.ghi"
 * ```
 */
export function parseCookieHeader(
  cookieHeader: string | null | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (cookieHeader === null || cookieHeader === undefined || cookieHeader.trim().length === 0) {
    return result;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (key.length === 0) {
      continue;
    }

    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }

  return result;
}

/**
 * Extracts and reassembles a NextAuth session token from either single or chunked cookies.
 *
 * Supports both production (`__Secure-next-auth.session-token`) and development
 * (`next-auth.session-token`) cookie prefixes, including chunked variations (`.0`, `.1`, etc.).
 *
 * @param cookieHeader - The raw `Cookie` header string or an already-parsed cookie dictionary.
 * @returns The complete stringified NextAuth session JWT, or `null` if not found.
 *
 * @example
 * ```typescript
 * const token = extractNextAuthCookie(req.headers.cookie);
 * ```
 */
export function extractNextAuthCookie(
  cookieHeader: string | Record<string, string> | null | undefined,
): string | null {
  if (cookieHeader === null || cookieHeader === undefined) {
    return null;
  }

  const cookies =
    typeof cookieHeader === "string"
      ? parseCookieHeader(cookieHeader)
      : cookieHeader;

  for (const baseCookieName of NEXTAUTH_SESSION_COOKIE_NAMES) {
    // 1. Direct single cookie check
    const directValue = cookies[baseCookieName];
    if (directValue !== undefined && directValue.length > 0) {
      return directValue;
    }

    // 2. Chunked cookie check (e.g. next-auth.session-token.0, next-auth.session-token.1, ...)
    const chunk0 = cookies[`${baseCookieName}.0`];
    if (chunk0 !== undefined && chunk0.length > 0) {
      let assembled = chunk0;
      let chunkIndex = 1;
      while (cookies[`${baseCookieName}.${chunkIndex}`] !== undefined) {
        assembled += cookies[`${baseCookieName}.${chunkIndex}`];
        chunkIndex++;
      }
      return assembled;
    }
  }

  return null;
}

/**
 * Verifies and decodes a NextAuth session JWT using the secret key.
 *
 * @param rawToken - The raw NextAuth JWT string extracted from a cookie or Authorization header.
 * @param secret - Optional secret override. Defaults to `process.env.NEXTAUTH_SECRET`.
 * @returns Decoded `JWT` payload or `null` if verification fails or token is invalid.
 *
 * @example
 * ```typescript
 * const jwtPayload = await verifyNextAuthJwt(rawToken);
 * if (jwtPayload !== null) {
 *   console.log(`Authenticated user: ${jwtPayload.username}`);
 * }
 * ```
 */
export async function verifyNextAuthJwt(
  rawToken: string | null | undefined,
  secret: string | null | undefined = process.env.NEXTAUTH_SECRET,
): Promise<JWT | null> {
  if (rawToken === null || rawToken === undefined || rawToken.trim().length === 0) {
    return null;
  }

  let effectiveSecret =
    secret ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!effectiveSecret) {
    return null;
  }
  effectiveSecret = effectiveSecret.trim().replace(/^["']|["']$/g, "");

  try {
    const decoded = await decode({
      token: rawToken.trim(),
      secret: effectiveSecret,
    });

    if (decoded === null || typeof decoded !== "object") {
      return null;
    }

    return decoded as JWT;
  } catch {
    return null;
  }
}

/**
 * Extracts a Bearer token from an `Authorization` header string.
 *
 * @param authorizationHeader - The raw `Authorization` header string (e.g. `Bearer <token>`).
 * @returns The raw token string or `null` if not a valid Bearer authorization header.
 *
 * @example
 * ```typescript
 * const token = extractBearerToken(req.headers.authorization);
 * ```
 */
export function extractBearerToken(
  authorizationHeader: string | null | undefined,
): string | null {
  if (
    authorizationHeader === null ||
    authorizationHeader === undefined ||
    authorizationHeader.trim().length === 0
  ) {
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

/**
 * Computes a secure SHA-256 hex digest hash for an API key.
 *
 * @param apiKey - Plaintext API key string.
 * @returns 64-character lowercase hexadecimal SHA-256 hash string.
 *
 * @example
 * ```typescript
 * const hash = hashApiKey("iris_live_abc123xyz");
 * ```
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey.trim()).digest("hex");
}
