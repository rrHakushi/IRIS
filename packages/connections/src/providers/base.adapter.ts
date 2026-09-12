import { createHash, randomBytes } from "node:crypto";
import type {
  AuthUrlOptions,
  AuthUrlResult,
  ConnectionAuthType,
  ConnectionCategory,
  ConnectionCredentials,
  ConnectionProvider,
  ConnectionProviderAdapter,
  ConnectionUserProfile,
  OAuthTokens,
  ProviderCapability,
} from "../types/index.js";

export class ConnectionError extends Error {
  constructor(
    message: string,
    public readonly provider: ConnectionProvider,
    public readonly statusCode?: number,
    public readonly rawError?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ConnectionError";
  }
}

export class ConnectionAuthError extends ConnectionError {
  constructor(
    message: string,
    provider: ConnectionProvider,
    statusCode = 401,
    rawError?: unknown
  ) {
    super(message, provider, statusCode, rawError);
    this.name = "ConnectionAuthError";
  }
}

export class ConnectionRateLimitError extends ConnectionError {
  constructor(
    message: string,
    provider: ConnectionProvider,
    public readonly retryAfterSeconds?: number
  ) {
    super(message, provider, 429);
    this.name = "ConnectionRateLimitError";
  }
}

export abstract class BaseConnectionAdapter implements ConnectionProviderAdapter {
  abstract readonly provider: ConnectionProvider;
  abstract readonly category: ConnectionCategory;
  abstract readonly authType: ConnectionAuthType;
  abstract readonly iconUrl: string;
  abstract readonly capabilities: ProviderCapability;
  readonly defaultHostUrl?: string = undefined;
  readonly requiredEnvVars?: readonly string[] = [];
  readonly optionalEnvVars?: readonly string[] = [];

  /**
   * Checks whether all required environment variables for this connection adapter are defined.
   */
  isConfigured(): boolean {
    return this.getMissingEnvVars().length === 0;
  }

  /**
   * Returns list of required environment variables that are missing.
   */
  getMissingEnvVars(): string[] {
    if (!this.requiredEnvVars || this.requiredEnvVars.length === 0) {
      return [];
    }
    return this.requiredEnvVars.filter((varName) => {
      const val = process.env[varName];
      return val === undefined || val === null || val.trim() === "";
    });
  }

  /**
   * Helper to generate a cryptographically random PKCE code verifier and S256 code challenge.
   */
  protected generatePkcePair(customVerifier?: string): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier =
      customVerifier ||
      randomBytes(32)
        .toString("base64url")
        .replace(/[^a-zA-Z0-9\-._~]/g, "")
        .slice(0, 128);

    const hash = createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = hash.toString("base64url");

    return { codeVerifier, codeChallenge };
  }

  /**
   * Helper to perform typed HTTP requests with standard error handling.
   */
  protected async fetchJson<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const defaultHeaders: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
    };

    const mergedHeaders = {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || 60;
        throw new ConnectionRateLimitError(
          `Rate limit exceeded for provider ${this.provider}. Try again in ${retryAfter}s.`,
          this.provider,
          retryAfter
        );
      }

      if (response.status === 401 || response.status === 403) {
        let errBody = "";
        try {
          errBody = await response.text();
        } catch {}
        throw new ConnectionAuthError(
          `Authentication failed (${response.status}): ${errBody || response.statusText}`,
          this.provider,
          response.status,
          errBody
        );
      }

      if (!response.ok) {
        let errBody = "";
        try {
          errBody = await response.text();
        } catch {}
        throw new ConnectionError(
          `Request failed with status ${response.status}: ${errBody || response.statusText}`,
          this.provider,
          response.status,
          errBody
        );
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return (await response.json()) as T;
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } catch (err: unknown) {
      if (
        err instanceof ConnectionError ||
        err instanceof ConnectionAuthError ||
        err instanceof ConnectionRateLimitError
      ) {
        throw err;
      }
      throw new ConnectionError(
        (err as Error).message || "Network request failed",
        this.provider,
        undefined,
        err
      );
    }
  }

  abstract getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult>;

  abstract exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    options?: { hostUrl?: string; [key: string]: unknown }
  ): Promise<OAuthTokens>;

  abstract getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile>;

  abstract testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile }>;
}
