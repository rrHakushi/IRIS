import {
  BaseConnectionAdapter,
  ConnectionAuthError,
  ConnectionError,
} from "../base.adapter.js";
import type {
  AuthUrlOptions,
  AuthUrlResult,
  ConnectionAuthType,
  ConnectionCategory,
  ConnectionCredentials,
  ConnectionProvider,
  ConnectionUserProfile,
  LibraryItem,
  MediaSearchResult,
  MediaType,
  OAuthTokens,
  ProviderCapability,
  SearchOptions,
  UpdateMediaPayload,
} from "../../types/index.js";

export interface IrisAuthUrlOptions extends AuthUrlOptions {
  hostUrl?: string;
  clientId?: string;
}

export interface IrisCredentials extends ConnectionCredentials {
  accessToken?: string;
  refreshToken?: string;
  hostUrl?: string;
  clientId?: string;
  clientSecret?: string;
  tokens?: OAuthTokens;
}

export class IrisAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "IRIS";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "/icons/iris.svg";

  // IRIS instances can be configured dynamically per host or via environment variables
  readonly requiredEnvVars = [] as const;
  readonly optionalEnvVars = ["IRIS_CLIENT_ID", "IRIS_CLIENT_SECRET"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "TRACKING",
    supportsOAuth: true,
    supportsApiKey: false,
    supportsCredentials: false,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: true,
    supportsGamingLibrary: false,
  };

  /**
   * Always considered configured because it supports dynamic client registration
   * and host URL inputs at runtime.
   */
  override isConfigured(): boolean {
    return true;
  }

  private normalizeHost(hostUrl?: string): string {
    const raw = hostUrl || process.env.NEXTAUTH_URL || "http://localhost:4000";
    return raw.replace(/\/+$/, "");
  }

  /**
   * Generates authorization URL for a remote IRIS instance with PKCE.
   */
  async getAuthUrl(options: IrisAuthUrlOptions): Promise<AuthUrlResult> {
    const host = this.normalizeHost(options.hostUrl);
    const clientId = options.clientId || process.env.IRIS_CLIENT_ID || "iris_federation_client";
    const state = options.state || Math.random().toString(36).substring(2);
    const { codeVerifier, codeChallenge } = this.generatePkcePair(options.codeVerifier);

    const scopes = options.scopes?.length
      ? options.scopes.join(" ")
      : "identify profile email lists:read lists:write offline_access";

    const url = new URL(`${host}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return {
      url: url.toString(),
      state,
      codeVerifier,
    };
  }

  /**
   * Exchanges authorization code for OAuth access and refresh tokens.
   */
  async exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    options?: { hostUrl?: string; [key: string]: unknown }
  ): Promise<OAuthTokens> {
    const host = this.normalizeHost(options?.hostUrl);
    const clientId = process.env.IRIS_CLIENT_ID || "iris_federation_client";
    const clientSecret = process.env.IRIS_CLIENT_SECRET;

    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
    };

    if (clientSecret) {
      body.client_secret = clientSecret;
    }
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    }>(`${host}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const expiresIn = res.expires_in ?? 30 * 24 * 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      accessToken: res.access_token,
      tokenType: res.token_type || "Bearer",
      expiresAt,
      refreshToken: res.refresh_token,
      scope: res.scope,
      hostUrl: host,
    };
  }

  /**
   * Refreshes an expired access token using the refresh token.
   */
  async refreshTokens(
    refreshToken: string,
    credentials: IrisCredentials
  ): Promise<OAuthTokens> {
    const host = this.normalizeHost(credentials.hostUrl);
    const clientId = credentials.clientId || process.env.IRIS_CLIENT_ID || "iris_federation_client";

    const body: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    };
    if (credentials.clientSecret) {
      body.client_secret = credentials.clientSecret;
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    }>(`${host}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const expiresIn = res.expires_in ?? 30 * 24 * 3600;
    return {
      accessToken: res.access_token,
      tokenType: res.token_type || "Bearer",
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      refreshToken: res.refresh_token || refreshToken,
      scope: res.scope,
      hostUrl: host,
    };
  }

  /**
   * Fetches user profile from the remote IRIS instance.
   */
  async getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile> {
    const creds = credentials as IrisCredentials;
    const token = creds.accessToken || creds.tokens?.accessToken;
    if (!token) {
      throw new ConnectionAuthError("Missing access token for IRIS instance", this.provider);
    }
    const host = this.normalizeHost(creds.hostUrl);

    const user = await this.fetchJson<{
      sub?: string;
      id?: string;
      username: string;
      name?: string;
      email?: string;
      picture?: string;
      avatarUrl?: string;
    }>(`${host}/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const id = user.id || user.sub || user.username;
    return {
      id,
      username: user.username,
      displayName: user.name || user.username,
      avatarUrl: user.avatarUrl || user.picture || undefined,
      profileUrl: `${host}/users/${user.username}`,
      email: user.email,
    };
  }

  /**
   * Tests connection to remote IRIS instance using credentials.
   */
  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile }> {
    try {
      const profile = await this.getProfile(credentials);
      return { ok: true, profile };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to reach remote IRIS instance" };
    }
  }

  /**
   * Synchronizes media lists from the remote IRIS instance.
   */
  async fetchUserLibrary(
    credentials: IrisCredentials,
    mediaType?: MediaType
  ): Promise<LibraryItem[]> {
    const token = credentials.accessToken || credentials.tokens?.accessToken;
    if (!token) {
      throw new ConnectionAuthError("Missing access token for IRIS library sync", this.provider);
    }
    const host = this.normalizeHost(credentials.hostUrl);

    try {
      const typeQuery = mediaType ? `?type=${mediaType.toLowerCase()}` : "";
      const res = await this.fetchJson<{
        success: boolean;
        items?: Array<{
          id?: string;
          mediaId: string;
          title: string;
          type: string;
          status: string;
          score?: number;
          progress?: number;
          totalCount?: number;
        }>;
      }>(`${host}/lists${typeQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.items) return [];

      return res.items.map((item) => ({
        id: item.id || item.mediaId,
        externalId: item.mediaId,
        provider: "IRIS",
        mediaType: (item.type?.toUpperCase() as MediaType) || "ANIME",
        title: item.title,
        status: (item.status?.toUpperCase() as any) || "COMPLETED",
        score: item.score,
        progress: item.progress,
        totalProgress: item.totalCount,
        updatedAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  async searchMedia(
    query: string,
    credentials: IrisCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const host = this.normalizeHost(credentials.hostUrl);
    const token = credentials.accessToken || credentials.tokens?.accessToken;
    const type = options?.type?.toLowerCase() || "anime";

    try {
      const res = await this.fetchJson<{
        success: boolean;
        results?: Array<{
          id: string;
          title: string;
          type: string;
          coverImage?: string;
          year?: number;
        }>;
      }>(`${host}/search?q=${encodeURIComponent(query)}&type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      return (res.results || []).map((r) => ({
        id: r.id,
        externalId: r.id,
        provider: "IRIS",
        mediaType: (r.type?.toUpperCase() as MediaType) || "ANIME",
        title: {
          userPreferred: r.title,
        },
        coverImage: r.coverImage ? { large: r.coverImage } : undefined,
        releaseYear: r.year,
      }));
    } catch {
      return [];
    }
  }

  async scrobbleMedia(
    payload: UpdateMediaPayload,
    credentials: IrisCredentials
  ): Promise<boolean> {
    const token = credentials.accessToken || credentials.tokens?.accessToken;
    if (!token) return false;
    const host = this.normalizeHost(credentials.hostUrl);

    try {
      await this.fetchJson(`${host}/lists/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return true;
    } catch {
      return false;
    }
  }
}
