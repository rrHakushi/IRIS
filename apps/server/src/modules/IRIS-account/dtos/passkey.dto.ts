import { tags } from "typia";

/**
 * Request payload for generating WebAuthn authentication options.
 */
export interface IPasskeyLoginOptionsRequest {
  /**
   * Optional username or email to narrow down registered credentials on the client.
   *
   * @example "alice@example.com"
   */
  readonly identifier?: string & tags.MinLength<3>;
}

/**
 * Public-key credential descriptor for WebAuthn allowed credentials.
 */
export interface IPublicKeyCredentialDescriptor {
  /**
   * Base64URL-encoded credential ID.
   *
   * @example "k8A1b..._credId"
   */
  readonly id: string;

  /**
   * Credential type (always 'public-key').
   *
   * @example "public-key"
   */
  readonly type: "public-key";

  /**
   * Supported authenticator transports.
   *
   * @example ["internal", "hybrid", "usb"]
   */
  readonly transports?: readonly string[];
}

/**
 * WebAuthn authentication options sent to the browser for `navigator.credentials.get()`.
 */
export interface IPasskeyLoginOptionsResponse {
  /**
   * Cryptographic random challenge.
   *
   * @example "a8e93f7b2c1d0e4f"
   */
  readonly challenge: string;

  /**
   * Relying party identifier.
   *
   * @example "localhost"
   */
  readonly rpId: string;

  /**
   * Allowed credentials for the user, if known.
   */
  readonly allowCredentials?: readonly IPublicKeyCredentialDescriptor[];

  /**
   * Challenge timeout in milliseconds.
   *
   * @example 60000
   */
  readonly timeout: number;

  /**
   * User verification preference.
   *
   * @example "preferred"
   */
  readonly userVerification: "required" | "preferred" | "discouraged";
}

/**
 * Request payload for verifying a passkey assertion.
 */
export interface IPasskeyVerifyLoginRequest {
  /**
   * WebAuthn assertion response object returned from `navigator.credentials.get()`.
   */
  readonly passkeyResponse: {
    /**
     * Base64URL credential ID.
     * @example "k8A1b..._credId"
     */
    readonly id: string;
    /**
     * Raw credential ID.
     * @example "k8A1b..._rawId"
     */
    readonly rawId: string;
    /**
     * Assertion cryptographic payload.
     */
    readonly response: {
      /**
       * Base64URL clientDataJSON.
       * @example "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiLi4ifQ=="
       */
      readonly clientDataJSON: string;
      /**
       * Base64URL authenticatorData.
       * @example "SZYN5YgOJ8Um5Bg5267CES4cjShj2vx..."
       */
      readonly authenticatorData: string;
      /**
       * Base64URL signature.
       * @example "MEQCIC8f7K1a..."
       */
      readonly signature: string;
      /**
       * User handle if present.
       * @example null
       */
      readonly userHandle?: string | null;
    };
    /**
     * Type descriptor.
     * @example "public-key"
     */
    readonly type: "public-key";
    /**
     * Optional client extensions.
     */
    readonly clientExtensionResults?: Record<string, boolean | string | number | object>;
  };

  /**
   * Optional MFA challenge ticket if completing secondary authentication.
   *
   * @example "mfa_9a8b7c6d5e4f3a2b"
   */
  readonly mfaTicket?: string | null;
}

/**
 * WebAuthn registration options sent to the browser for `navigator.credentials.create()`.
 */
export interface IPasskeyRegisterOptionsResponse {
  /**
   * Cryptographic random challenge.
   *
   * @example "c8f92a1e4d3b7e6f"
   */
  readonly challenge: string;

  /**
   * Relying party entity.
   */
  readonly rp: {
    /**
     * Display name of the application.
     * @example "IRIS"
     */
    readonly name: string;
    /**
     * RP domain identifier.
     * @example "localhost"
     */
    readonly id: string;
  };

  /**
   * User identity entity.
   */
  readonly user: {
    /**
     * User identifier.
     * @example "usr_01h45y9xnv18gqz040y8xzy09a"
     */
    readonly id: string;
    /**
     * User primary email/username.
     * @example "alice@example.com"
     */
    readonly name: string;
    /**
     * User display name.
     * @example "Alice"
     */
    readonly displayName: string;
  };

  /**
   * Supported cryptographic algorithms.
   */
  readonly pubKeyCredParams: readonly {
    readonly alg: number;
    readonly type: "public-key";
  }[];

  /**
   * Challenge timeout in milliseconds.
   *
   * @example 60000
   */
  readonly timeout: number;

  /**
   * Authenticator selection criteria.
   */
  readonly authenticatorSelection?: {
    readonly residentKey?: "required" | "preferred" | "discouraged";
    readonly userVerification?: "required" | "preferred" | "discouraged";
  };
}

/**
 * Request payload for completing passkey registration.
 */
export interface IPasskeyRegisterVerifyRequest {
  /**
   * WebAuthn attestation response returned from `navigator.credentials.create()`.
   */
  readonly passkeyResponse: {
    /**
     * Base64URL credential ID.
     * @example "k8A1b..._credId"
     */
    readonly id: string;
    /**
     * Raw credential ID.
     * @example "k8A1b..._rawId"
     */
    readonly rawId: string;
    /**
     * Attestation cryptographic payload.
     */
    readonly response: {
      /**
       * Base64URL clientDataJSON.
       * @example "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoiLi4ifQ=="
       */
      readonly clientDataJSON: string;
      /**
       * Base64URL attestationObject.
       * @example "o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVj..."
       */
      readonly attestationObject: string;
      /**
       * Transports supported by the authenticator.
       * @example ["internal"]
       */
      readonly transports?: readonly string[];
      /**
       * Public key algorithm (e.g. -7 for ES256).
       * @example -7
       */
      readonly publicKeyAlgorithm?: number;
      /**
       * Base64URL public key.
       * @example "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..."
       */
      readonly publicKey?: string;
      /**
       * Base64URL authenticatorData.
       * @example "SZYN5YgOJ8Um5Bg5267CES4cjShj2vx..."
       */
      readonly authenticatorData?: string;
    };
    /**
     * Type descriptor.
     * @example "public-key"
     */
    readonly type: "public-key";
    /**
     * Optional client extensions.
     */
    readonly clientExtensionResults?: Record<string, boolean | string | number | object>;
  };

  /**
   * Optional custom label for the passkey (e.g. "MacBook Touch ID", "YubiKey").
   *
   * @example "MacBook Touch ID"
   */
  readonly name?: (string & tags.MinLength<1> & tags.MaxLength<64>) | null;
}

/**
 * Summary of a registered passkey.
 */
export interface IPasskeySummary {
  /**
   * Unique passkey identifier.
   *
   * @example "pk_01h45y9xnv18gqz040y8xzy09b"
   */
  readonly id: string;

  /**
   * User-defined friendly name.
   *
   * @example "MacBook Touch ID"
   */
  readonly name: string | null;

  /**
   * Registration ISO timestamp.
   *
   * @example "2026-08-24T12:00:00.000Z"
   */
  readonly createdAt: string;
}
