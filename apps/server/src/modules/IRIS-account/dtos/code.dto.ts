import { tags } from "typia";

/**
 * Request payload for initializing a quick-connect login code on a new device.
 */
export interface ILoginCodeGenerateRequest {
  /**
   * Optional friendly identifier of the requesting client device (e.g. "Living Room TV", "iPad Pro").
   *
   * @example "Living Room Apple TV"
   */
  readonly deviceName?: (string & tags.MaxLength<64>) | null;
}

/**
 * Response payload returned to the new device containing the quick-connect code and QR session payload.
 */
export interface ILoginCodeGenerateResponse {
  /**
   * Short alphanumeric code displayed on screen (e.g. "ABC-123").
   *
   * @example "ABC-123"
   */
  readonly code: string;

  /**
   * Polling session token used by the new device to check approval status.
   *
   * @example "sess_9f8e7d6c5b4a31"
   */
  readonly sessionToken: string;

  /**
   * Deep-link payload or URI encoded in the QR code for instant phone scanning.
   *
   * @example "iris://auth/quick-connect?token=sess_9f8e7d6c5b4a31"
   */
  readonly qrPayload: string;

  /**
   * Validity duration in seconds (300 seconds = 5 minutes).
   *
   * @example 300
   */
  readonly expiresIn: number;
}

/**
 * Query parameters for checking the authorization status of a login code session.
 */
export interface ILoginCodeStatusQuery {
  /**
   * Polling session token generated in the initial request.
   *
   * @example "sess_9f8e7d6c5b4a31"
   */
  readonly sessionToken: string & tags.MinLength<10>;
}

/**
 * Status response returned to the polling device.
 */
export interface ILoginCodeStatusResponse {
  /**
   * Current lifecycle status of the login session.
   *
   * @example "approved"
   */
  readonly status: "pending" | "approved" | "expired";

  /**
   * Authenticated user details once approved, or null.
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
  } | null;

  /**
   * JWT session token once approved, or null.
   *
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  readonly token: string | null;
}

/**
 * Request payload submitted by an authenticated device to approve a quick-connect code.
 */
export interface ILoginCodeApproveRequest {
  /**
   * The alphanumeric quick-connect code or QR session token to approve.
   *
   * @example "ABC-123"
   */
  readonly code: string & tags.MinLength<6> & tags.MaxLength<64>;
}
