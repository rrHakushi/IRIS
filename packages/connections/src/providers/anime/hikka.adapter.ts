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

export class HikkaAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "HIKKA";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "/icons/connections/hikka.svg";
  readonly requiredEnvVars = ["HIKKA_CLIENT_ID", "HIKKA_CLIENT_SECRET"] as const;

  private static readonly BASE_URL = "https://api.hikka.io";
  private static readonly USER_AGENT = "IRIS/1.0 (https://github.com/rrHakushi/IRIS)";

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "TRACKING",
    supportsOAuth: true,
    supportsApiKey: true,
    supportsCredentials: true,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: false,
  };

  private getClientId(): string {
    return Bun.env.HIKKA_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return Bun.env.HIKKA_CLIENT_SECRET || "";
  }

  private getAuthToken(credentials?: ConnectionCredentials): string | undefined {
    return credentials?.apiKey || credentials?.accessToken;
  }

  private buildHeaders(credentials?: ConnectionCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": HikkaAdapter.USER_AGENT,
      Accept: "application/json",
    };
    const token = this.getAuthToken(credentials);
    if (token) {
      headers["auth"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new ConnectionError("Missing HIKKA_CLIENT_ID environment variable", this.provider);
    }
    const state = options.state || Math.random().toString(36).substring(2);

    const url = new URL("https://hikka.io/oauth");
    url.searchParams.set("reference", clientId);
    url.searchParams.set("scope", "user-details,watchlist,readlist");
    url.searchParams.set("state", state);

    return {
      url: url.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    code: string,
    _redirectUri: string
  ): Promise<OAuthTokens> {
    const clientSecret = this.getClientSecret();
    if (!clientSecret) {
      throw new ConnectionError("Missing HIKKA_CLIENT_SECRET environment variable", this.provider);
    }

    const res = await this.fetchJson<{
      expiration: number;
      created: number;
      secret: string;
    }>(`${HikkaAdapter.BASE_URL}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": HikkaAdapter.USER_AGENT,
      },
      body: JSON.stringify({
        request_reference: code,
        client_secret: clientSecret,
      }),
    });

    return {
      accessToken: res.secret,
      tokenType: "Bearer",
      expiresAt: res.expiration ? new Date(res.expiration * 1000) : null,
    };
  }

  async getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile> {
    const token = this.getAuthToken(credentials);
    if (!token) {
      throw new ConnectionAuthError("Missing Hikka API or session token", this.provider);
    }

    const data = await this.fetchJson<{
      reference: string;
      username: string;
      description?: string;
      avatar?: string;
    }>(`${HikkaAdapter.BASE_URL}/user/me`, {
      headers: this.buildHeaders(credentials),
    });

    return {
      id: data.reference || data.username,
      username: data.username,
      displayName: data.username,
      avatarUrl: data.avatar || undefined,
      profileUrl: `https://hikka.io/user/${data.username}`,
    };
  }

  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile; credentials?: ConnectionCredentials }> {
    try {
      const token = this.getAuthToken(credentials);
      if (!token && credentials.username && credentials.password) {
        // Attempt login if user provided credentials
        try {
          const loginRes = await fetch(`${HikkaAdapter.BASE_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": HikkaAdapter.USER_AGENT,
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });
          if (!loginRes.ok) {
            const errData = (await loginRes.json().catch(() => ({}))) as any;
            if (loginRes.status === 422 || loginRes.status === 400) {
              return {
                ok: false,
                message:
                  errData?.detail?.[0]?.msg ||
                  "Hikka requires captcha verification on password login. Please provide your personal session/auth token directly.",
              };
            }
            return {
              ok: false,
              message: errData?.message || "Failed to log into Hikka with provided credentials",
            };
          }
          const tokenData = (await loginRes.json()) as any;
          if (tokenData?.access_token || tokenData?.token) {
            const acquiredToken = tokenData.access_token || tokenData.token;
            const updatedCreds: ConnectionCredentials = {
              ...credentials,
              apiKey: acquiredToken,
              accessToken: acquiredToken,
            };
            const profile = await this.getProfile(updatedCreds);
            return { ok: true, profile, credentials: updatedCreds };
          }
        } catch (e: any) {
          return {
            ok: false,
            message: e?.message || "Hikka credentials login failed",
          };
        }
      }

      const profile = await this.getProfile(credentials);
      return { ok: true, profile };
    } catch (err: unknown) {
      return {
        ok: false,
        message: (err as Error).message || "Hikka connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const isManga = options?.type === "MANGA" || options?.type === "BOOK";
    const endpoint = isManga ? "/manga" : "/anime";
    const page = options?.page || 1;
    const size = Math.min(options?.perPage || 20, 50);

    const data = await this.fetchJson<{
      list: Array<{
        slug: string;
        title_en?: string;
        title_ua?: string;
        title_ja?: string;
        title_native?: string;
        image?: string;
        episodes_total?: number;
        chapters_total?: number;
        volumes_total?: number;
        score?: number;
        year?: number;
        synopsis_en?: string;
        synopsis_ua?: string;
      }>;
      pagination: {
        page: number;
        size: number;
        total: number;
      };
    }>(`${HikkaAdapter.BASE_URL}${endpoint}?page=${page}&size=${size}`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.trim(),
      }),
    });

    return (data.list || []).map((item) => ({
      id: item.slug,
      externalId: item.slug,
      provider: "HIKKA",
      mediaType: isManga ? "MANGA" : "ANIME",
      title: {
        userPreferred: item.title_en || item.title_ua || item.title_ja || item.title_native || item.slug,
        english: item.title_en,
        romaji: item.title_ja,
        native: item.title_native,
      },
      description: item.synopsis_en || item.synopsis_ua,
      coverImage: item.image ? { large: item.image, medium: item.image } : undefined,
      episodes: item.episodes_total,
      chapters: item.chapters_total,
      volumes: item.volumes_total,
      averageScore: item.score ? Math.round(item.score * 10) : undefined,
      releaseYear: item.year,
      url: `https://hikka.io/${isManga ? "manga" : "anime"}/${item.slug}`,
    }));
  }

  async getMediaById(
    externalId: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const isManga = options?.type === "MANGA" || options?.type === "BOOK";
    const slug = externalId.trim();
    if (!slug) return null;

    try {
      const endpoint = isManga ? `/manga/${encodeURIComponent(slug)}` : `/anime/${encodeURIComponent(slug)}`;
      const item = await this.fetchJson<{
        slug: string;
        title_en?: string;
        title_ua?: string;
        title_ja?: string;
        title_native?: string;
        image?: string;
        episodes_total?: number;
        chapters_total?: number;
        volumes_total?: number;
        score?: number;
        year?: number;
        synopsis_en?: string;
        synopsis_ua?: string;
      }>(`${HikkaAdapter.BASE_URL}${endpoint}`, {
        headers: this.buildHeaders(credentials),
      });

      if (!item || !item.slug) return null;

      return {
        id: item.slug,
        externalId: item.slug,
        provider: "HIKKA",
        mediaType: isManga ? "MANGA" : "ANIME",
        title: {
          userPreferred: item.title_en || item.title_ua || item.title_ja || item.title_native || item.slug,
          english: item.title_en,
          romaji: item.title_ja,
          native: item.title_native,
        },
        description: item.synopsis_en || item.synopsis_ua,
        coverImage: item.image ? { large: item.image, medium: item.image } : undefined,
        episodes: item.episodes_total,
        chapters: item.chapters_total,
        volumes: item.volumes_total,
        averageScore: item.score ? Math.round(item.score * 10) : undefined,
        releaseYear: item.year,
        url: `https://hikka.io/${isManga ? "manga" : "anime"}/${item.slug}`,
      };
    } catch {
      return null;
    }
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    options?: { type?: string }
  ): Promise<LibraryItem[]> {
    const profile = await this.getProfile(credentials);
    const isManga = options?.type === "MANGA" || options?.type === "BOOK";
    const endpoint = isManga
      ? `${HikkaAdapter.BASE_URL}/read/manga/${profile.username}/list?page=1&size=100`
      : `${HikkaAdapter.BASE_URL}/watch/${profile.username}/list?page=1&size=100`;

    const data = await this.fetchJson<{
      list: Array<{
        status: string;
        episodes?: number;
        chapters?: number;
        volumes?: number;
        score?: number;
        anime?: { slug: string; title_en?: string; title_ua?: string; image?: string; episodes_total?: number };
        manga?: { slug: string; title_en?: string; title_ua?: string; image?: string; chapters_total?: number };
        updated?: number;
      }>;
    }>(endpoint, {
      method: "POST",
      headers: {
        ...this.buildHeaders(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const statusMap: Record<string, LibraryItem["status"]> = {
      watching: "IN_PROGRESS",
      reading: "IN_PROGRESS",
      completed: "COMPLETED",
      planned: "PLANNED",
      on_hold: "ON_HOLD",
      dropped: "DROPPED",
    };

    return (data.list || []).map((entry) => {
      const media = entry.anime || entry.manga;
      const slug = media?.slug || "";
      return {
        id: slug,
        externalId: slug,
        provider: "HIKKA",
        mediaType: isManga ? "MANGA" : "ANIME",
        title: media?.title_en || media?.title_ua || slug,
        status: statusMap[entry.status.toLowerCase()] || "IN_PROGRESS",
        score: entry.score ? entry.score * 10 : null,
        progress: entry.episodes ?? entry.chapters ?? 0,
        progressVolumes: entry.volumes,
        totalEpisodes: entry.anime?.episodes_total ?? entry.manga?.chapters_total,
        updatedAt: entry.updated ? new Date(entry.updated * 1000) : undefined,
      };
    });
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    const token = this.getAuthToken(credentials);
    if (!token) {
      throw new ConnectionAuthError("Missing Hikka API or session token for entry update", this.provider);
    }

    const slug = String(payload.mediaId).trim();
    if (!slug) {
      throw new ConnectionError("Invalid Hikka media slug/ID", this.provider);
    }

    const isManga = payload.mediaType === "MANGA" || payload.mediaType === "BOOK";

    // Map status to Hikka WatchStatusEnum / ReadStatusEnum
    let mappedStatus = isManga ? "reading" : "watching";
    if (payload.status) {
      const s = payload.status.toUpperCase();
      switch (s) {
        case "PLANNED":
        case "PLANNING":
        case "WISH":
          mappedStatus = "planned";
          break;
        case "COMPLETED":
        case "COLLECT":
          mappedStatus = "completed";
          break;
        case "IN_PROGRESS":
        case "WATCHING":
        case "READING":
        case "REPEATING":
          mappedStatus = isManga ? "reading" : "watching";
          break;
        case "ON_HOLD":
        case "PAUSED":
          mappedStatus = "on_hold";
          break;
        case "DROPPED":
          mappedStatus = "dropped";
          break;
      }
    }

    const scoreVal =
      payload.score !== undefined && payload.score !== null && payload.score > 0
        ? Math.min(10, Math.max(1, Math.round(Number(payload.score) > 10 ? Number(payload.score) / 10 : Number(payload.score))))
        : 0;

    if (isManga) {
      const readBody: Record<string, unknown> = {
        status: mappedStatus,
        chapters: Number(payload.progress || 0),
        volumes: Number(payload.extra?.volumes || 0),
        score: scoreVal,
      };
      if (payload.notes) {
        readBody.note = String(payload.notes).slice(0, 2048);
      }
      if (payload.startedAt) {
        const d = new Date(payload.startedAt);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
          readBody.start_date = Math.floor(d.getTime() / 1000);
        }
      }
      if (payload.completedAt) {
        const d = new Date(payload.completedAt);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
          readBody.end_date = Math.floor(d.getTime() / 1000);
        }
      }

      await this.fetchJson(`${HikkaAdapter.BASE_URL}/read/manga/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: {
          ...this.buildHeaders(credentials),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(readBody),
      });
    } else {
      const watchBody: Record<string, unknown> = {
        status: mappedStatus,
        episodes: Number(payload.progress || 0),
        rewatches: Number(payload.rewatched || 0),
        score: scoreVal,
      };
      if (payload.notes) {
        watchBody.note = String(payload.notes).slice(0, 2048);
      }
      if (payload.startedAt) {
        const d = new Date(payload.startedAt);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
          watchBody.start_date = Math.floor(d.getTime() / 1000);
        }
      }
      if (payload.completedAt) {
        const d = new Date(payload.completedAt);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
          watchBody.end_date = Math.floor(d.getTime() / 1000);
        }
      }

      await this.fetchJson(`${HikkaAdapter.BASE_URL}/watch/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: {
          ...this.buildHeaders(credentials),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(watchBody),
      });
    }

    return true;
  }
}
