import CredentialsProvider from "next-auth/providers/credentials";
import type { IConnection } from "@IRIS/api";
import * as api from "@IRIS/api";
import { AuthUser, CredentialsPayload, MfaType } from "../types.js";
import { getApiConnection } from "../connection.js";

/**
 * Normalizes incoming form credentials into a strictly-typed `CredentialsPayload`.
 *
 * @param raw - Raw string dictionary submitted through the login form.
 * @returns A structured `CredentialsPayload` instance.
 */
export function parseCredentialsPayload(
  raw: Record<string, string> | null | undefined,
): CredentialsPayload {
  const data = raw ?? {};
  return {
    identifier: data.identifier?.trim() || null,
    password: data.password || null,
    mfaType: (data.mfaType as MfaType) || null,
    mfaCode: data.mfaCode?.trim() || null,
    mfaTicket: data.mfaTicket?.trim() || null,
    passkeyResponse: data.passkeyResponse || null,
    isPasskeyOnly: data.isPasskeyOnly === "true",
    isLoginCode: data.isLoginCode === "true",
    loginCode: data.loginCode?.trim() || null,
  };
}

/**
 * Handles primary username/email and password authentication via `@IRIS/api`.
 *
 * @param identifier - Username or email address.
 * @param password - Plaintext password submitted by the user.
 * @param connection - Optional IConnection instance.
 * @returns Authenticated `AuthUser` object, or throws on invalid credentials / MFA required.
 */
export async function handlePasswordLogin(
  identifier: string,
  password: string,
  connection: IConnection = getApiConnection(),
): Promise<AuthUser | null> {
  if (!identifier || !password) {
    return null;
  }

  const response = await api.functional.auth.login(connection, {
    identifier,
    password,
  });

  if (response.mfaRequired) {
    throw new Error(
      JSON.stringify({
        error: "MFA_REQUIRED",
        mfaTicket: response.mfaTicket,
        allowedMfaTypes: response.allowedMfaTypes,
      }),
    );
  }

  if (response.success && response.user) {
    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      passwordChangedAt: response.user.passwordChangedAt,
    };
  }

  return null;
}

/**
 * Handles Multi-Factor Authentication (TOTP, Email Code, or WebAuthn Passkey) via `@IRIS/api`.
 *
 * @param payload - The MFA challenge response payload.
 * @param connection - Optional IConnection instance.
 * @returns Authenticated `AuthUser` object, or throws on invalid MFA challenge.
 */
export async function handleMfaVerification(
  payload: CredentialsPayload,
  connection: IConnection = getApiConnection(),
): Promise<AuthUser | null> {
  if (payload.mfaType === "passkey" && payload.passkeyResponse) {
    const passkeyJson =
      typeof payload.passkeyResponse === "string"
        ? JSON.parse(payload.passkeyResponse)
        : payload.passkeyResponse;

    const response = await api.functional.auth.passkey.verify_login.verifyLogin(
      connection,
      {
        passkeyResponse: passkeyJson,
        mfaTicket: payload.mfaTicket ?? undefined,
      },
    );

    if (response.success && response.user) {
      return {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        passwordChangedAt: response.user.passwordChangedAt,
      };
    }
  }

  if (!payload.mfaTicket || !payload.mfaCode || !payload.mfaType) {
    throw new Error("Missing required MFA verification parameters.");
  }

  const response = await api.functional.account.mfa.verify.verifyMfa(
    connection,
    {
      mfaTicket: payload.mfaTicket,
      mfaType: payload.mfaType as "totp" | "email" | "backup_code",
      code: payload.mfaCode,
    },
  );

  if (response.success && response.user) {
    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      passwordChangedAt: response.user.passwordChangedAt,
    };
  }

  return null;
}

/**
 * Handles passwordless passkey-only (WebAuthn) authentication via `@IRIS/api`.
 *
 * @param passkeyResponse - Stringified WebAuthn credential assertion payload.
 * @param connection - Optional IConnection instance.
 * @returns Authenticated `AuthUser` object matching the passkey owner.
 */
export async function handlePasskeyOnlyLogin(
  passkeyResponse: string,
  connection: IConnection = getApiConnection(),
): Promise<AuthUser | null> {
  if (!passkeyResponse) {
    throw new Error("Invalid passkey response.");
  }

  const parsed =
    typeof passkeyResponse === "string"
      ? JSON.parse(passkeyResponse)
      : passkeyResponse;

  const response = await api.functional.auth.passkey.verify_login.verifyLogin(
    connection,
    {
      passkeyResponse: parsed,
    },
  );

  if (response.success && response.user) {
    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      passwordChangedAt: response.user.passwordChangedAt,
    };
  }

  return null;
}

/**
 * Handles quick-connect device code or QR-code authentication (Jellyfin/Discord style) via `@IRIS/api`.
 *
 * @param loginCode - Alphanumeric code or session token.
 * @param connection - Optional IConnection instance.
 * @returns Authenticated `AuthUser` approved by the secondary device.
 */
export async function handleLoginCodeVerification(
  loginCode: string,
  connection: IConnection = getApiConnection(),
): Promise<AuthUser | null> {
  if (!loginCode) {
    throw new Error("Invalid login code.");
  }

  const response = await api.functional.auth.code.status.getStatus(connection, {
    sessionToken: loginCode,
  });

  if (response.status === "approved" && response.user) {
    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      passwordChangedAt: response.user.passwordChangedAt,
    };
  }

  throw new Error(`Device authorization status is '${response.status}'.`);
}

/**
 * Creates the NextAuth `CredentialsProvider` configured to handle all IRIS authentication strategies using `@IRIS/api`.
 *
 * @param connection - Optional customized backend API connection.
 * @returns A NextAuth CredentialsProvider instance.
 */
export function createCredentialsProvider(connection?: IConnection) {
  const conn = connection ?? getApiConnection();

  return CredentialsProvider({
    id: "credentials",
    name: "IRIS Credentials",
    credentials: {
      identifier: { label: "Username or Email", type: "text" },
      password: { label: "Password", type: "password" },
      mfaType: { label: "MFA Type", type: "text" },
      mfaCode: { label: "MFA Code", type: "text" },
      mfaTicket: { label: "MFA Ticket", type: "text" },
      passkeyResponse: { label: "Passkey Response", type: "text" },
      isPasskeyOnly: { label: "Is Passkey Only", type: "text" },
      isLoginCode: { label: "Is Login Code", type: "text" },
      loginCode: { label: "Login Code", type: "text" },
    },
    async authorize(credentials: Record<string, string> | undefined): Promise<AuthUser | null> {
      const payload = parseCredentialsPayload(credentials);

      // Strategy 1: Passwordless Passkey Login
      if (payload.isPasskeyOnly) {
        if (!payload.passkeyResponse) {
          throw new Error("Missing passkey assertion response.");
        }
        return handlePasskeyOnlyLogin(payload.passkeyResponse, conn);
      }

      // Strategy 2: Quick-Connect Login Code (Jellyfin / QR style)
      if (payload.isLoginCode) {
        if (!payload.loginCode) {
          throw new Error("Missing login code.");
        }
        return handleLoginCodeVerification(payload.loginCode, conn);
      }

      // Strategy 3: Multi-Factor Authentication
      if (payload.mfaType !== null || payload.mfaTicket !== null) {
        return handleMfaVerification(payload, conn);
      }

      // Strategy 4: Standard Username / Email + Password Login
      if (!payload.identifier) {
        throw new Error("Missing username or email identifier.");
      }
      if (!payload.password) {
        throw new Error("Missing password.");
      }

      return handlePasswordLogin(payload.identifier, payload.password, conn);
    },
  });
}
