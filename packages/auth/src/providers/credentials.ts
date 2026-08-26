import CredentialsProvider from "next-auth/providers/credentials";
import { AuthUser, CredentialsPayload, MfaType } from "../types.js";
import { elysia, type ElysiaClient } from "../elysia.js";

/**
 * Normalizes incoming form credentials into a strictly-typed `CredentialsPayload`.
 *
 * @param raw - Raw string dictionary submitted through the login form.
 * @returns A structured `CredentialsPayload` instance.
 */
export function parseCredentialsPayload(
  raw: Record<string, string> | null | undefined
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
 * Handles primary username/email and password authentication via Elysia Eden Treaty.
 *
 * @param identifier - Username or email address.
 * @param password - Plaintext password submitted by the user.
 * @param client - Optional Eden Treaty client instance (defaults to `elysia`).
 * @returns Authenticated `AuthUser` object, or throws on invalid credentials / MFA required.
 */
export async function handlePasswordLogin(
  identifier: string,
  password: string,
  client: ElysiaClient = elysia
): Promise<AuthUser | null> {
  if (!identifier || !password) {
    return null;
  }
  const { data, error } = await client.auth.login.post({
    identifier,
    password,
  });

  if (error || !data) {
    const errorMsg =
      typeof error?.value === "object" && error?.value && "message" in error.value
        ? String((error.value as { message: unknown }).message)
        : "Invalid username, email, or password.";
    throw new Error(errorMsg);
  }

  const response = data as {
    success: boolean;
    mfaRequired: boolean;
    mfaTicket: string | null;
    allowedMfaTypes: string[] | null;
    user: {
      id: string;
      username: string;
      email: string;
      passwordChangedAt: number | null;
    } | null;
  };

  if (response.mfaRequired) {
    throw new Error(
      JSON.stringify({
        error: "MFA_REQUIRED",
        mfaTicket: response.mfaTicket,
        allowedMfaTypes: response.allowedMfaTypes,
      })
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
 * Handles Multi-Factor Authentication (TOTP, Email Code, or WebAuthn Passkey) via Elysia Eden Treaty.
 *
 * @param payload - The MFA challenge response payload.
 * @param client - Optional Eden Treaty client instance (defaults to `elysia`).
 * @returns Authenticated `AuthUser` object, or throws on invalid MFA challenge.
 */
export async function handleMfaVerification(
  payload: CredentialsPayload,
  client: ElysiaClient = elysia
): Promise<AuthUser | null> {
  if (payload.mfaType === "passkey" && payload.passkeyResponse) {
    const passkeyJson =
      typeof payload.passkeyResponse === "string"
        ? JSON.parse(payload.passkeyResponse)
        : payload.passkeyResponse;

    const { data, error } = await client.auth.passkey["verify-login"].post({
      passkeyResponse: passkeyJson,
      mfaTicket: payload.mfaTicket ?? undefined,
    });

    if (error || !data) {
      throw new Error("Passkey verification failed.");
    }

    const response = data as {
      success: boolean;
      user: {
        id: string;
        username: string;
        email: string;
        passwordChangedAt: number | null;
      } | null;
    };

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

  const { data, error } = await client.account.mfa.verify.post({
    mfaTicket: payload.mfaTicket,
    mfaType: payload.mfaType as "totp" | "email" | "backup_code",
    code: payload.mfaCode,
  });

  if (error || !data) {
    throw new Error("MFA verification failed.");
  }

  const response = data as {
    success: boolean;
    user: {
      id: string;
      username: string;
      email: string;
      passwordChangedAt: number | null;
    } | null;
  };

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
 * Handles passwordless passkey-only (WebAuthn) authentication via Elysia Eden Treaty.
 *
 * @param passkeyResponse - Stringified WebAuthn credential assertion payload.
 * @param client - Optional Eden Treaty client instance (defaults to `elysia`).
 * @returns Authenticated `AuthUser` object matching the passkey owner.
 */
export async function handlePasskeyOnlyLogin(
  passkeyResponse: string,
  client: ElysiaClient = elysia
): Promise<AuthUser | null> {
  if (!passkeyResponse) {
    throw new Error("Invalid passkey response.");
  }

  const parsed =
    typeof passkeyResponse === "string"
      ? JSON.parse(passkeyResponse)
      : passkeyResponse;

  const { data, error } = await client.auth.passkey["verify-login"].post({
    passkeyResponse: parsed,
  });

  if (error || !data) {
    throw new Error("Passkey login failed.");
  }

  const response = data as {
    success: boolean;
    user: {
      id: string;
      username: string;
      email: string;
      passwordChangedAt: number | null;
    } | null;
  };

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
 * Handles quick-connect device code or QR-code authentication (Jellyfin/Discord style) via Elysia Eden Treaty.
 *
 * @param loginCode - Alphanumeric code or session token.
 * @param client - Optional Eden Treaty client instance (defaults to `elysia`).
 * @returns Authenticated `AuthUser` approved by the secondary device.
 */
export async function handleLoginCodeVerification(
  loginCode: string,
  client: ElysiaClient = elysia
): Promise<AuthUser | null> {
  if (!loginCode) {
    throw new Error("Invalid login code.");
  }

  const { data, error } = await client.auth.code.status.get({
    query: {
      sessionToken: loginCode,
    },
  });

  if (error || !data) {
    throw new Error("Failed to check device login code status.");
  }

  const response = data as {
    status: "pending" | "approved" | "expired";
    user: {
      id: string;
      username: string;
      email: string;
      passwordChangedAt: number | null;
    } | null;
  };

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
 * Creates the NextAuth `CredentialsProvider` configured to handle all IRIS authentication strategies using Eden Treaty.
 *
 * @param client - Optional customized backend API Eden client (defaults to `elysia`).
 * @returns A NextAuth CredentialsProvider instance.
 */
export function createCredentialsProvider(client: ElysiaClient = elysia) {
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
        return handlePasskeyOnlyLogin(payload.passkeyResponse, client);
      }

      // Strategy 2: Quick-Connect Login Code (Jellyfin / QR style)
      if (payload.isLoginCode) {
        if (!payload.loginCode) {
          throw new Error("Missing login code.");
        }
        return handleLoginCodeVerification(payload.loginCode, client);
      }

      // Strategy 3: Multi-Factor Authentication
      if (payload.mfaType !== null || payload.mfaTicket !== null) {
        return handleMfaVerification(payload, client);
      }

      // Strategy 4: Standard Username / Email + Password Login
      if (!payload.identifier) {
        throw new Error("Missing username or email identifier.");
      }
      if (!payload.password) {
        throw new Error("Missing password.");
      }

      return handlePasswordLogin(payload.identifier, payload.password, client);
    },
  });
}
