import {
  BaseConnectionAdapter,
  ConnectionAuthError,
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
} from "../../types/index.js";

export class BangumiAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "BANGUMI";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/bangumi.svg";
  readonly requiredEnvVars = ["BANGUMI_CLIENT_ID", "BANGUMI_CLIENT_SECRET"] as const;

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
    return process.env.BANGUMI_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.BANGUMI_CLIENT_SECRET || "";
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    const state = options.state || Math.random().toString(36).substring(2);
    const url = new URL("https://bgm.tv/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("state", state);

    return {
      url: url.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await this.fetchJson<{
      access_token: string;
      expires_in: number;
      token_type: string;
      refresh_token: string;
      user_id: number;
    }>("https://bgm.tv/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 604800) * 1000);

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      tokenType: res.token_type || "Bearer",
      userId: res.user_id,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const res = await this.fetchJson<{
      access_token: string;
      expires_in: number;
      token_type: string;
      refresh_token: string;
    }>("https://bgm.tv/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 604800) * 1000);

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      tokenType: res.token_type || "Bearer",
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      throw new ConnectionAuthError("Missing access token or API token for Bangumi", this.provider);
    }

    const data = await this.fetchJson<{
      id: number;
      username: string;
      nickname: string;
      avatar?: { large?: string; medium?: string; small?: string };
      sign?: string;
    }>("https://api.bgm.tv/v0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      id: String(data.id),
      username: data.username || String(data.id),
      displayName: data.nickname || data.username,
      avatarUrl: data.avatar?.large || data.avatar?.medium,
      profileUrl: `https://bgm.tv/user/${data.username || data.id}`,
    };
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
        message: (err as Error).message || "Bangumi connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const token = credentials?.accessToken || credentials?.apiKey;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Bangumi subject type: 1 = Book, 2 = Anime, 3 = Music, 4 = Game, 6 = Real
    const typeFilter =
      options?.type === "MANGA" || options?.type === "BOOK"
        ? [1]
        : options?.type === "GAME"
          ? [4]
          : [2];

    const limit = options?.perPage || 20;
    const offset = ((options?.page || 1) - 1) * limit;

    const data = await this.fetchJson<{
      total: number;
      limit: number;
      offset: number;
      data: Array<{
        id: number;
        type: number;
        name: string;
        name_cn: string;
        summary: string;
        date?: string;
        images?: { large?: string; common?: string; medium?: string; small?: string };
        score?: number;
        rank?: number;
        eps?: number;
        volumes?: number;
      }>;
    }>("https://api.bgm.tv/v0/search/subjects", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: query,
        filter: {
          type: typeFilter,
        },
        limit,
        offset,
      }),
    });

    return (data.data || []).map((sub) => ({
      id: String(sub.id),
      externalId: String(sub.id),
      provider: "BANGUMI",
      mediaType: sub.type === 1 ? "MANGA" : sub.type === 4 ? "GAME" : "ANIME",
      title: {
        userPreferred: sub.name_cn || sub.name,
        native: sub.name,
        romaji: sub.name,
      },
      description: sub.summary,
      coverImage: {
        large: sub.images?.large || sub.images?.common,
        medium: sub.images?.medium,
      },
      episodes: sub.eps,
      volumes: sub.volumes,
      averageScore: sub.score ? Math.round(sub.score * 10) : undefined,
      releaseYear: sub.date ? parseInt(sub.date.substring(0, 4), 10) : undefined,
      url: `https://bgm.tv/subject/${sub.id}`,
    }));
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    _options?: { type?: string }
  ): Promise<LibraryItem[]> {
    const profile = await this.getProfile(credentials);
    const token = credentials.accessToken || credentials.apiKey;

    const data = await this.fetchJson<{
      data: Array<{
        subject_id: number;
        subject_type: number;
        type: number; // 1: Wish, 2: Done, 3: Doing, 4: On Hold, 5: Dropped
        rate: number;
        ep_status: number;
        vol_status: number;
        updated_at: string;
        comment?: string;
        subject: {
          name: string;
          name_cn: string;
          eps: number;
        };
      }>;
    }>(`https://api.bgm.tv/v0/users/${profile.username}/collections?limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const statusMap: Record<number, LibraryItem["status"]> = {
      1: "PLANNING",
      2: "COMPLETED",
      3: "CURRENT",
      4: "PAUSED",
      5: "DROPPED",
    };

    return (data.data || []).map((entry) => ({
      id: String(entry.subject_id),
      externalId: String(entry.subject_id),
      provider: "BANGUMI",
      mediaType: entry.subject_type === 1 ? "MANGA" : "ANIME",
      title: entry.subject?.name_cn || entry.subject?.name || `Subject ${entry.subject_id}`,
      status: statusMap[entry.type] || "CURRENT",
      score: entry.rate ? entry.rate * 10 : null,
      progress: entry.ep_status,
      progressVolumes: entry.vol_status,
      totalEpisodes: entry.subject?.eps,
      updatedAt: entry.updated_at ? new Date(entry.updated_at) : undefined,
      notes: entry.comment,
    }));
  }
}
