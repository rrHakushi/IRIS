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

export class BangumiAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "BANGUMI";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "/icons/connections/bangumi.svg";
  readonly requiredEnvVars = ["BANGUMI_CLIENT_ID", "BANGUMI_CLIENT_SECRET"] as const;

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
    supportsGamingLibrary: true,
  };

  private getClientId(): string {
    return Bun.env.BANGUMI_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return Bun.env.BANGUMI_CLIENT_SECRET || "";
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
        "User-Agent": BangumiAdapter.USER_AGENT,
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
    const headers: Record<string, string> = {
      "User-Agent": BangumiAdapter.USER_AGENT,
    };
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

    const executeSearch = async (authToken?: string) => {
      const headers: Record<string, string> = {
        "User-Agent": BangumiAdapter.USER_AGENT,
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      return this.fetchJson<{
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
        headers,
        body: JSON.stringify({
          keyword: query,
          filter: {
            type: typeFilter,
          },
          limit,
          offset,
        }),
      });
    };

    let data;
    try {
      data = await executeSearch(token);
    } catch (err: unknown) {
      // If token expired or is unauthorized, retry search without auth header as endpoint is public
      if (token && (err instanceof ConnectionAuthError || String(err).includes("401"))) {
        data = await executeSearch(undefined);
      } else {
        throw err;
      }
    }

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

  async getMediaById(
    externalId: string,
    credentials?: ConnectionCredentials,
    _options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const token = credentials?.accessToken || credentials?.apiKey;
    const fetchSubject = async (authToken?: string) => {
      const headers: Record<string, string> = {
        "User-Agent": BangumiAdapter.USER_AGENT,
      };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      return this.fetchJson<{
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
      }>(`https://api.bgm.tv/v0/subjects/${externalId}`, {
        headers,
      });
    };

    try {
      let sub;
      try {
        sub = await fetchSubject(token);
      } catch (err: unknown) {
        if (token && (err instanceof ConnectionAuthError || String(err).includes("401"))) {
          sub = await fetchSubject(undefined);
        } else {
          throw err;
        }
      }

      if (!sub || !sub.id) return null;

      return {
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
      };
    } catch {
      return null;
    }
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
        "User-Agent": BangumiAdapter.USER_AGENT,
      },
    });

    const statusMap: Record<number, LibraryItem["status"]> = {
      1: "PLANNED",
      2: "COMPLETED",
      3: "IN_PROGRESS",
      4: "ON_HOLD",
      5: "DROPPED",
    };

    return (data.data || []).map((entry) => ({
      id: String(entry.subject_id),
      externalId: String(entry.subject_id),
      provider: "BANGUMI",
      mediaType:
        entry.subject_type === 1
          ? "MANGA"
          : entry.subject_type === 4
            ? "GAME"
            : "ANIME",
      title: entry.subject?.name_cn || entry.subject?.name || `Subject ${entry.subject_id}`,
      status: statusMap[entry.type] || "IN_PROGRESS",
      score: entry.rate ? entry.rate * 10 : null,
      progress: entry.ep_status,
      progressVolumes: entry.vol_status,
      totalEpisodes: entry.subject?.eps,
      updatedAt: entry.updated_at ? new Date(entry.updated_at) : undefined,
      notes: entry.comment,
    }));
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError(
        "Missing access token for Bangumi update",
        this.provider
      );
    }

    const providerId = Number(payload.mediaId);
    if (Number.isNaN(providerId) || providerId <= 0) {
      throw new ConnectionError(
        `Invalid Bangumi media ID: ${payload.mediaId}`,
        this.provider
      );
    }

    // 1: wish, 2: collect, 3: do, 4: on_hold, 5: dropped
    let bangumiType = 3;
    if (payload.status) {
      const s = payload.status.toUpperCase();
      switch (s) {
        case "PLANNED":
        case "PLANNING":
        case "WISH":
          bangumiType = 1;
          break;
        case "COMPLETED":
        case "COLLECT":
          bangumiType = 2;
          break;
        case "IN_PROGRESS":
        case "REPEATING":
        case "WATCHING":
        case "READING":
        case "PLAYING":
        case "LISTENING":
        case "TRACKING":
        case "DO":
          bangumiType = 3;
          break;
        case "ON_HOLD":
        case "PAUSED":
          bangumiType = 4;
          break;
        case "DROPPED":
          bangumiType = 5;
          break;
      }
    }

    const normMediaType = String(payload.mediaType || "").toUpperCase();
    const isBook = normMediaType === "MANGA" || normMediaType === "BOOK";

    const body: Record<string, unknown> = {
      type: bangumiType,
    };
    if (payload.score !== undefined && payload.score !== null && payload.score > 0) {
      body.rate = Math.min(10, Math.max(1, Math.round(Number(payload.score))));
    }
    // In Bangumi collection API, ep_status and vol_status are STRICTLY only allowed for books/manga.
    // Setting them on any other subject type (Anime, Game, Music) produces a 400 "can't set 'vol_status' or 'ep_status' on non-book subject" error.
    if (isBook) {
      if (payload.progress !== undefined && payload.progress !== null) {
        body.ep_status = Number(payload.progress);
      }
      if (payload.extra?.volumes !== undefined && payload.extra.volumes !== null) {
        body.vol_status = Number(payload.extra.volumes);
      }
    }
    if (payload.notes !== undefined && payload.notes !== null) {
      body.comment = String(payload.notes);
    }

    try {
      await this.fetchJson(`https://api.bgm.tv/v0/users/-/collections/${providerId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": BangumiAdapter.USER_AGENT,
        },
        body: JSON.stringify(body),
      });
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes("non-book subject") || errStr.includes("vol_status") || errStr.includes("ep_status")) {
        // Fallback retry: strip vol_status and ep_status if subject type mismatch on Bangumi
        delete body.vol_status;
        delete body.ep_status;
        await this.fetchJson(`https://api.bgm.tv/v0/users/-/collections/${providerId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": BangumiAdapter.USER_AGENT,
          },
          body: JSON.stringify(body),
        });
      } else {
        throw err;
      }
    }

    // For Anime episode progress, Bangumi requires episode collection update via PATCH /v0/users/-/collections/{subject_id}/episodes
    if (
      normMediaType === "ANIME" &&
      payload.progress !== undefined &&
      payload.progress !== null &&
      Number(payload.progress) > 0
    ) {
      try {
        const targetProgress = Number(payload.progress);
        const offset = Math.max(0, Math.floor((targetProgress - 1) / 100) * 100);
        const epData = await this.fetchJson<{
          total: number;
          data: Array<{ id: number; sort: number; type: number }>;
        }>(`https://api.bgm.tv/v0/episodes?subject_id=${providerId}&type=0&limit=100&offset=${offset}`, {
          headers: {
            "User-Agent": BangumiAdapter.USER_AGENT,
          },
        });

        // Filter standard episodes (type === 0) up to target progress
        const targetEpIds = (epData.data || [])
          .filter((ep) => ep.sort <= targetProgress && ep.type === 0)
          .map((ep) => ep.id);

        if (targetEpIds.length > 0) {
          await this.fetchJson(`https://api.bgm.tv/v0/users/-/collections/${providerId}/episodes`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${credentials.accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": BangumiAdapter.USER_AGENT,
            },
            body: JSON.stringify({
              episode_id: targetEpIds,
              type: 2, // 2: Watched
            }),
          });
        }
      } catch {
        // Episode progress sync on Bangumi is best-effort and non-fatal
      }
    }

    return true;
  }
}
