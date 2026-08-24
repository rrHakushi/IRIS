import "next-auth";
import "next-auth/jwt";

/**
 * Authenticated user payload stored in the NextAuth session.
 *
 * Exclusively holds essential user identifiers and the security timestamp.
 */
export interface AuthUser {
  /**
   * Unique user identifier (UUID).
   */
  id: string;

  /**
   * Unique username of the user.
   */
  username: string;

  /**
   * Primary email address of the user, or null.
   */
  email: string | null;

  /**
   * UNIX timestamp in seconds when the user's password was last changed, or null if never changed.
   */
  passwordChangedAt: number | null;
}

/**
 * Supported Multi-Factor Authentication (MFA) verification types.
 */
export type MfaType = "totp" | "email" | "passkey";

/**
 * Authentication strategy mode used during credentials verification.
 */
export type AuthStrategy = "password" | "mfa" | "passkey" | "login_code";

/**
 * Form inputs and credentials payload passed during authentication.
 */
export interface CredentialsPayload {
  /**
   * Username or email address identifier.
   */
  readonly identifier: string | null;

  /**
   * Plain text password submitted for primary authentication.
   */
  readonly password: string | null;

  /**
   * The type of MFA challenge being responded to.
   */
  readonly mfaType: MfaType | null;

  /**
   * One-time passcode (TOTP or Email verification code).
   */
  readonly mfaCode: string | null;

  /**
   * Temporary MFA challenge ticket or session token from the initial password step.
   */
  readonly mfaTicket: string | null;

  /**
   * Serialized WebAuthn assertion response for passkey authentication.
   */
  readonly passkeyResponse: string | null;

  /**
   * Whether this is a passwordless passkey-only login attempt.
   */
  readonly isPasskeyOnly: boolean;

  /**
   * Whether this is a quick-connect login code attempt.
   */
  readonly isLoginCode: boolean;

  /**
   * Quick-connect numeric or alphanumeric login code / QR session token.
   */
  readonly loginCode: string | null;
}

declare module "next-auth" {
  interface Session {
    user: AuthUser;
    error: string | null;
  }

  interface User {
    id: string;
    username: string;
    email?: string | null;
    passwordChangedAt?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    email: string | null;
    passwordChangedAt: number | null;
    iat: number | null;
    error: string | null;
  }
}
