import crypto from "node:crypto";
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
  OAuthTokens,
  ProviderCapability,
  SearchOptions,
  UpdateMediaPayload,
} from "../../types/index.js";

export class MangaBakaAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "MANGABAKA";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "/icons/connections/mangabaka.svg";
  readonly requiredEnvVars = ["MANGABAKA_CLIENT_ID"] as const;
  readonly optionalEnvVars = ["MANGABAKA_CLIENT_SECRET"] as const;

  private static readonly API_BASE = "https://api.mangabaka.org";
  private static readonly AUTH_BASE = "https://mangabaka.org/auth/oauth2";
  private static readonly USER_AGENT = "IRIS/1.0 (https://github.com/rrHakushi/IRIS)";

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "TRACKING",
    supportsOAuth: true,
    supportsApiKey: true,
    supportsCredentials: false,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: false,
  };

  private getClientId(): string {
    return (Bun.env.MANGABAKA_CLIENT_ID || "").trim();
  }

  private getClientSecret(): string {
    return (Bun.env.MANGABAKA_CLIENT_SECRET || "").trim();
  }

  private getAuthToken(credentials?: ConnectionCredentials): string | undefined {
    return credentials?.accessToken || credentials?.apiKey;
  }

  private buildHeaders(credentials?: ConnectionCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": MangaBakaAdapter.USER_AGENT,
      Accept: "application/json",
    };
    const token = this.getAuthToken(credentials);
    if (token) {
      if (token.startsWith("mb-")) {
        // MangaBaka Personal Access Token (PAT)
        headers["x-api-key"] = token;
      } else {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new ConnectionError("Missing MANGABAKA_CLIENT_ID environment variable", this.provider);
    }
    const state = options.state || Math.random().toString(36).substring(2);

    const url = new URL(`${MangaBakaAdapter.AUTH_BASE}/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("scope", "library.read library.write openid profile offline_access");
    url.searchParams.set("state", state);

    if (options.codeVerifier) {
      const challenge = crypto
        .createHash("sha256")
        .update(options.codeVerifier)
        .digest("base64url");
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
    }

    return {
      url: url.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    });

    if (clientSecret) {
      bodyParams.set("client_secret", clientSecret);
    }
    if (codeVerifier) {
      bodyParams.set("code_verifier", codeVerifier);
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    }>(`${MangaBakaAdapter.AUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": MangaBakaAdapter.USER_AGENT,
      },
      body: bodyParams.toString(),
    });

    const expiresAt = res.expires_in
      ? new Date(Date.now() + res.expires_in * 1000)
      : undefined;

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      tokenType: res.token_type || "Bearer",
      scope: res.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    });

    if (clientSecret) {
      bodyParams.set("client_secret", clientSecret);
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    }>(`${MangaBakaAdapter.AUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": MangaBakaAdapter.USER_AGENT,
      },
      body: bodyParams.toString(),
    });

    const expiresAt = res.expires_in
      ? new Date(Date.now() + res.expires_in * 1000)
      : undefined;

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token || refreshToken,
      expiresAt,
      tokenType: res.token_type || "Bearer",
      scope: res.scope,
    };
  }

  async getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile> {
    const token = this.getAuthToken(credentials);
    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaBaka access token or API key",
        this.provider
      );
    }

    try {
      const res = await this.fetchJson<{
        status: number;
        data: {
          id: string;
          nickname?: string | null;
          preferred_username?: string | null;
          picture?: string | null;
          role?: string;
        };
      }>(`${MangaBakaAdapter.API_BASE}/v1/my/profile`, {
        headers: this.buildHeaders(credentials),
      });

      const profile = res.data;
      const username =
        profile.preferred_username || profile.nickname || profile.id || "MangaBakaUser";

      return {
        id: profile.id || username,
        username,
        displayName: profile.nickname || profile.preferred_username || username,
        avatarUrl: profile.picture || undefined,
        profileUrl: `https://mangabaka.org/user/${encodeURIComponent(username)}`,
      };
    } catch (err: unknown) {
      // Fallback: try userinfo endpoint if v1/my/profile is unreachable
      try {
        const userinfo = await this.fetchJson<{
          sub: string;
          name?: string;
          picture?: string;
        }>(`${MangaBakaAdapter.AUTH_BASE}/userinfo`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": MangaBakaAdapter.USER_AGENT,
          },
        });

        const name = userinfo.name || userinfo.sub;
        return {
          id: userinfo.sub,
          username: name,
          displayName: name,
          avatarUrl: userinfo.picture,
          profileUrl: `https://mangabaka.org/user/${encodeURIComponent(name)}`,
        };
      } catch {
        throw new ConnectionAuthError(
          `Failed to authenticate MangaBaka profile: ${(err as Error).message}`,
          this.provider
        );
      }
    }
  }

  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile }> {
    try {
      const profile = await this.getProfile(credentials);
      return { ok: true, profile };
    } catch (err: unknown) {
      return {
        ok: false,
        message: (err as Error).message || "MangaBaka connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const limit = Math.min(options?.perPage || 20, 50);
    const page = options?.page || 1;

    const url = new URL(`${MangaBakaAdapter.API_BASE}/v1/series/search`);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));

    const res = await this.fetchJson<{
      status: number;
      pagination?: { count: number; page: number; limit: number };
      data: Array<{
        id: number;
        title: string;
        native_title?: string;
        romanized_title?: string;
        canonical_url?: string;
        description?: string;
        year?: number;
        cover?: { url?: string };
        covers?: Array<{ url?: string; is_primary?: boolean }>;
      }>;
    }>(url.toString(), {
      headers: this.buildHeaders(credentials),
    });

    return (res.data || []).map((series) => {
      const coverUrl =
        series.cover?.url ||
        series.covers?.find((c) => c.is_primary)?.url ||
        series.covers?.[0]?.url;

      return {
        id: String(series.id),
        externalId: String(series.id),
        provider: "MANGABAKA",
        mediaType: "MANGA",
        title: {
          userPreferred: series.title,
          english: series.title,
          romaji: series.romanized_title,
          native: series.native_title,
        },
        description: series.description,
        coverImage: coverUrl ? { large: coverUrl, medium: coverUrl } : undefined,
        releaseYear: series.year,
        url: series.canonical_url || `https://mangabaka.org/series/${series.id}`,
      };
    });
  }

  async getMediaById(
    externalId: string,
    credentials?: ConnectionCredentials,
    _options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const numId = Number(externalId);
    if (Number.isNaN(numId) || numId <= 0) return null;

    try {
      const res = await this.fetchJson<{
        status: number;
        data: {
          id: number;
          title: string;
          native_title?: string;
          romanized_title?: string;
          canonical_url?: string;
          description?: string;
          year?: number;
          cover?: { url?: string };
          covers?: Array<{ url?: string; is_primary?: boolean }>;
        };
      }>(`${MangaBakaAdapter.API_BASE}/v1/series/${numId}`, {
        headers: this.buildHeaders(credentials),
      });

      if (!res?.data?.id) return null;
      const series = res.data;
      const coverUrl =
        series.cover?.url ||
        series.covers?.find((c) => c.is_primary)?.url ||
        series.covers?.[0]?.url;

      return {
        id: String(series.id),
        externalId: String(series.id),
        provider: "MANGABAKA",
        mediaType: "MANGA",
        title: {
          userPreferred: series.title,
          english: series.title,
          romaji: series.romanized_title,
          native: series.native_title,
        },
        description: series.description,
        coverImage: coverUrl ? { large: coverUrl, medium: coverUrl } : undefined,
        releaseYear: series.year,
        url: series.canonical_url || `https://mangabaka.org/series/${series.id}`,
      };
    } catch {
      return null;
    }
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    _options?: { type?: string }
  ): Promise<LibraryItem[]> {
    const token = this.getAuthToken(credentials);
    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaBaka access token or API key for library sync",
        this.provider
      );
    }

    const res = await this.fetchJson<{
      status: number;
      data: Array<{
        entry: {
          state: string;
          progress_chapter?: number | null;
          progress_volume?: number | null;
          rating?: number | null;
          note?: string | null;
        };
        series: {
          id: number;
          title: string;
        };
      }>;
    }>(`${MangaBakaAdapter.API_BASE}/v2/my/library`, {
      headers: this.buildHeaders(credentials),
    });

    const statusMap: Record<string, LibraryItem["status"]> = {
      reading: "IN_PROGRESS",
      rereading: "IN_PROGRESS",
      completed: "COMPLETED",
      plan_to_read: "PLANNED",
      considering: "PLANNED",
      paused: "ON_HOLD",
      dropped: "DROPPED",
    };

    return (res.data || []).map((item) => ({
      id: String(item.series.id),
      externalId: String(item.series.id),
      provider: "MANGABAKA",
      mediaType: "MANGA",
      title: item.series.title,
      status: statusMap[item.entry.state] || "IN_PROGRESS",
      score: item.entry.rating ? Math.round(item.entry.rating) : null,
      progress: item.entry.progress_chapter ?? 0,
      progressVolumes: item.entry.progress_volume ?? undefined,
      notes: item.entry.note ?? undefined,
    }));
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    const token = this.getAuthToken(credentials);
    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaBaka API token for updating entry",
        this.provider
      );
    }

    const seriesId = Number(payload.mediaId);
    if (Number.isNaN(seriesId) || seriesId <= 0) {
      throw new ConnectionError(
        `Invalid MangaBaka series ID: ${payload.mediaId}`,
        this.provider
      );
    }

    const stateMap: Record<string, string> = {
      IN_PROGRESS: "reading",
      WATCHING: "reading",
      READING: "reading",
      REPEATING: "rereading",
      COMPLETED: "completed",
      PLANNED: "plan_to_read",
      PLANNING: "plan_to_read",
      WISH: "plan_to_read",
      ON_HOLD: "paused",
      PAUSED: "paused",
      DROPPED: "dropped",
    };

    const state = payload.status
      ? stateMap[payload.status.toUpperCase()] || "reading"
      : undefined;

    const body: Record<string, unknown> = {};
    if (state) body.state = state;
    if (payload.progress !== undefined && payload.progress !== null) {
      body.progress_chapter = Math.min(10000, Math.max(0, Number(payload.progress)));
    }
    if (payload.extra?.volumes !== undefined && payload.extra.volumes !== null) {
      body.progress_volume = Math.min(10000, Math.max(0, Number(payload.extra.volumes)));
    }
    if (payload.score !== undefined && payload.score !== null && Number(payload.score) > 0) {
      // MangaBaka uses 0-100 rating scale
      const numScore = Number(payload.score);
      const scaled = numScore <= 10 ? numScore * 10 : numScore;
      body.rating = Math.min(100, Math.max(1, Math.round(scaled)));
    }
    if (payload.notes !== undefined && payload.notes !== null) {
      body.note = String(payload.notes);
    }

    // Try PATCH first (updates existing entry). If 404, call POST (creates library entry)
    const patchUrl = `${MangaBakaAdapter.API_BASE}/v1/my/library/${seriesId}`;
    try {
      await this.fetchJson(patchUrl, {
        method: "PATCH",
        headers: {
          ...this.buildHeaders(credentials),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return true;
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes("404") || errStr.toLowerCase().includes("not found")) {
        // Create new library entry
        await this.fetchJson(patchUrl, {
          method: "POST",
          headers: {
            ...this.buildHeaders(credentials),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: state || "reading",
            ...body,
          }),
        });
        return true;
      }
      throw err;
    }
  }
}
