import { tags } from "typia";

/**
 * Standard password format requirement:
 * - Minimum 12 characters, maximum 64 characters
 * - Must contain at least 2 numeric digits
 * - Must contain at least 1 special character
 *
 * @example "SuperSecretPass123!"
 */
export type IPasswordFormat = string &
  tags.MinLength<12> &
  tags.MaxLength<64> &
  tags.Pattern<"^(?=(?:.*\\d){2,})(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).*$">;

/**
 * Request payload for primary credential login.
 */
export interface ILoginRequest {
  /**
   * Username or email address identifier.
   *
   * @example "alice@example.com"
   */
  readonly identifier: string & tags.MinLength<3> & tags.MaxLength<255>;

  /**
   * User plaintext password.
   *
   * @example "SuperSecretPass123!"
   */
  readonly password: string & tags.MinLength<1> & tags.MaxLength<128>;
}

/**
 * Response payload returned upon successful primary login or MFA challenge.
 */
export interface ILoginResponse {
  /**
   * Whether authentication is fully complete.
   *
   * @example true
   */
  readonly success: boolean;

  /**
   * True if secondary Multi-Factor Authentication is required to complete login.
   *
   * @example false
   */
  readonly mfaRequired: boolean;

  /**
   * Short-lived MFA challenge ticket when `mfaRequired` is true, or null.
   *
   * @example null
   */
  readonly mfaTicket: string | null;

  /**
   * List of MFA verification methods available for the user.
   *
   * @example ["totp", "passkey"]
   */
  readonly allowedMfaTypes: readonly ("totp" | "email" | "passkey")[] | null;

  /**
   * Authenticated user session summary or null if pending MFA.
   */
  readonly user: {
    /**
     * Unique user identifier.
     * @example "usr_01h45y9xnv18gqz040y8xzy09a"
     */
    readonly id: string;
    /**
     * Account username.
     * @example "alice"
     */
    readonly username: string;
    /**
     * Primary email address.
     * @example "alice@example.com"
     */
    readonly email: string;
    /**
     * Timestamp of last password change.
     * @example 1718000000000
     */
    readonly passwordChangedAt: number | null;
  } | null;

  /**
   * JWT bearer session token or null if pending MFA.
   *
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  readonly token: string | null;
}

/**
 * Request payload for creating a new user account.
 */
export interface IRegisterRequest {
  /**
   * Unique alphanumeric username (3-32 chars, allowed: letters, numbers, underscores, hyphens).
   *
   * @example "alice"
   */
  readonly username: string &
    tags.MinLength<3> &
    tags.MaxLength<32> &
    tags.Pattern<"^[a-zA-Z0-9_-]+$">;

  /**
   * Valid primary email address.
   *
   * @example "alice@example.com"
   */
  readonly email: string & tags.Format<"email">;

  /**
   * Strong password meeting complexity requirements:
   * 12-64 characters, at least 2 numbers, at least 1 special character.
   *
   * @example "SuperSecretPass123!"
   */
  readonly password: IPasswordFormat;
}

/**
 * Response payload returned upon successful account registration.
 */
export interface IRegisterResponse {
  /**
   * Whether registration succeeded.
   *
   * @example true
   */
  readonly success: boolean;

  /**
   * Created user details and generated public key.
   */
  readonly user: {
    /**
     * Unique user identifier.
     * @example "usr_01h45y9xnv18gqz040y8xzy09a"
     */
    readonly id: string;
    /**
     * Account username.
     * @example "alice"
     */
    readonly username: string;
    /**
     * Primary email address.
     * @example "alice@example.com"
     */
    readonly email: string;
    /**
     * Timestamp of password creation.
     * @example 1718000000000
     */
    readonly passwordChangedAt: number | null;
    /**
     * User's public encryption key.
     * @example "MCowBQYDK2VwAyEA79vW1p9mFz...=="
     */
    readonly publicKey: string | null;
  };
}

/**
 * Request payload for changing the current user's password.
 */
export interface IPasswordChangeRequest {
  /**
   * Existing plaintext password.
   *
   * @example "SuperSecretPass123!"
   */
  readonly currentPassword: string & tags.MinLength<1>;

  /**
   * New strong password meeting complexity requirements.
   *
   * @example "NewStrongPassword456@"
   */
  readonly newPassword: IPasswordFormat;
}

/**
 * Request payload for initiating a forgotten password recovery email.
 */
export interface IPasswordForgotRequest {
  /**
   * Account email address to send the recovery link to.
   *
   * @example "alice@example.com"
   */
  readonly email: string & tags.Format<"email">;
}

/**
 * Request payload for completing a password reset using a recovery token.
 */
export interface IPasswordResetRequest {
  /**
   * Secure password reset token received via email.
   *
   * @example "tok_8f93e9a1bc40284e91"
   */
  readonly token: string & tags.MinLength<10>;

  /**
   * New strong password meeting complexity requirements.
   *
   * @example "BrandNewPassword789$"
   */
  readonly newPassword: IPasswordFormat;
}

/**
 * Standard operation status acknowledgment.
 */
export interface ISuccessResponse {
  /**
   * Whether the operation succeeded.
   *
   * @example true
   */
  readonly success: boolean;

  /**
   * Optional status message.
   *
   * @example "Operation completed successfully."
   */
  readonly message: string;
}
