import { Request } from "express";

/**
 * Supported authentication mechanisms.
 */
export type AuthMethod = "session" | "token" | "api_key" | "none";

/**
 * Strictly-typed user entity attached to authenticated HTTP requests.
 *
 * Exclusively holds essential user identifiers, permissions, and security timestamps.
 */
export interface AuthenticatedUser {
  /**
   * Unique user identifier (UUID).
   */
  readonly id: string;

  /**
   * Unique username of the user.
   */
  readonly username: string;

  /**
   * Primary email address of the user, or null.
   */
  readonly email: string | null;

  /**
   * Array of 32-bit permission integers assigned to the user.
   */
  readonly permissions: readonly number[];

  /**
   * UNIX timestamp in seconds when the user's password was last changed, or null.
   */
  readonly passwordChangedAt: number | null;
}

/**
 * Extended Express HTTP Request interface containing the authenticated user context.
 */
export interface RequestWithAuth extends Request {
  /**
   * Authenticated user entity or null if unauthenticated.
   */
  user: AuthenticatedUser | null;

  /**
   * Authentication mechanism used to resolve the user.
   */
  authMethod: AuthMethod;

  /**
   * Unique ID of the API key if authenticated via API key, or null.
   */
  apiKeyId?: string | null;
}

/**
 * Result of resolving authentication credentials from an incoming request.
 */
export interface AuthResolutionResult {
  /**
   * Authenticated user entity or null if authentication failed / credentials were not provided.
   */
  readonly user: AuthenticatedUser | null;

  /**
   * Authentication mechanism that succeeded, or "none".
   */
  readonly method: AuthMethod;

  /**
   * Optional API key identifier if authenticated via API key.
   */
  readonly apiKeyId?: string | null;
}
