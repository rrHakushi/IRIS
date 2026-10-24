import {
  BaseConnectionAdapter,
  ConnectionAuthError,
  ConnectionError,
} from "../base.adapter.js";
import type {
  ConnectionAuthType,
  ConnectionCategory,
  ConnectionCredentials,
  ConnectionProvider,
  ConnectionUserProfile,
  LibraryItem,
  MediaSearchResult,
  ProviderCapability,
  SearchOptions,
  UpdateMediaPayload,
} from "../../types/index.js";

export class MangaUpdatesAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "MANGAUPDATES";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "CREDENTIALS";
  readonly iconUrl = "/icons/connections/mangaupdates.svg";

  private static readonly BASE_URL = "https://api.mangaupdates.com/v1";
  private static readonly USER_AGENT = "IRIS/1.0 (https://github.com/rrHakushi/IRIS)";

  readonly capabilities: ProviderCapability = {
    authType: "CREDENTIALS",
    category: "TRACKING",
    supportsOAuth: false,
    supportsApiKey: true,
    supportsCredentials: true,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: false,
  };

  private getSessionToken(credentials?: ConnectionCredentials): string | undefined {
    return credentials?.accessToken || credentials?.apiKey;
  }

  private buildHeaders(credentials?: ConnectionCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent": MangaUpdatesAdapter.USER_AGENT,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const token = this.getSessionToken(credentials);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async getAuthUrl(_options: any): Promise<any> {
    throw new ConnectionError("MangaUpdates does not support OAuth authentication", this.provider);
  }

  async exchangeAuthCode(_code: string, _redirectUri: string): Promise<any> {
    throw new ConnectionError("MangaUpdates does not support OAuth code exchange", this.provider);
  }

  async loginWithCredentials(
    username?: string,
    password?: string
  ): Promise<{ sessionToken: string }> {
    if (!username || !password) {
      throw new ConnectionAuthError(
        "Username and password are required for MangaUpdates login",
        this.provider
      );
    }

    const res = await fetch(`${MangaUpdatesAdapter.BASE_URL}/account/login`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": MangaUpdatesAdapter.USER_AGENT,
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as any;
      throw new ConnectionAuthError(
        err?.reason || err?.message || `MangaUpdates login failed (${res.status})`,
        this.provider
      );
    }

    const data = (await res.json()) as any;
    const sessionToken = data?.context?.session_token;
    if (!sessionToken) {
      throw new ConnectionAuthError(
        "MangaUpdates login did not return a session token",
        this.provider
      );
    }

    return { sessionToken };
  }

  async getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile> {
    let token = this.getSessionToken(credentials);

    if (!token && credentials.username && credentials.password) {
      const login = await this.loginWithCredentials(credentials.username, credentials.password);
      token = login.sessionToken;
      credentials.accessToken = token;
      credentials.apiKey = token;
    }

    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaUpdates session token or credentials",
        this.provider
      );
    }

    const data = await this.fetchJson<{
      status?: string;
      context?: {
        user_id?: number;
        username?: string;
      };
      user_id?: number;
      username?: string;
      avatar?: { url?: { original?: string } };
    }>(`${MangaUpdatesAdapter.BASE_URL}/account/profile`, {
      headers: {
        "User-Agent": MangaUpdatesAdapter.USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
    });

    const username = data.username || data.context?.username || credentials.username || "MangaUpdatesUser";
    const userId = String(data.user_id || data.context?.user_id || username);

    return {
      id: userId,
      username,
      displayName: username,
      avatarUrl: data.avatar?.url?.original,
      profileUrl: `https://www.mangaupdates.com/members/${userId}`,
    };
  }

  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile; credentials?: ConnectionCredentials }> {
    try {
      let activeCreds = { ...credentials };
      if (!this.getSessionToken(activeCreds) && activeCreds.username && activeCreds.password) {
        const { sessionToken } = await this.loginWithCredentials(
          activeCreds.username,
          activeCreds.password
        );
        activeCreds.accessToken = sessionToken;
        activeCreds.apiKey = sessionToken;
      }

      const profile = await this.getProfile(activeCreds);
      return { ok: true, profile, credentials: activeCreds };
    } catch (err: unknown) {
      return {
        ok: false,
        message: (err as Error).message || "MangaUpdates connection test failed",
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

    const data = await this.fetchJson<{
      total_hits: number;
      page: number;
      per_page: number;
      results: Array<{
        record: {
          series_id: number;
          title: string;
          description?: string;
          year?: string;
          type?: string;
          image?: { url?: { original?: string; thumb?: string } };
          associated?: Array<{ title: string }>;
        };
      }>;
    }>(`${MangaUpdatesAdapter.BASE_URL}/series/search`, {
      method: "POST",
      headers: this.buildHeaders(credentials),
      body: JSON.stringify({
        search: query.trim(),
        stype: "title",
        perpage: limit,
        page,
      }),
    });

    return (data.results || []).map((hit) => {
      const rec = hit.record;
      const releaseYear = rec.year ? parseInt(rec.year, 10) : undefined;
      const coverUrl = rec.image?.url?.original || rec.image?.url?.thumb;

      return {
        id: String(rec.series_id),
        externalId: String(rec.series_id),
        provider: "MANGAUPDATES",
        mediaType: "MANGA",
        title: {
          userPreferred: rec.title,
          english: rec.title,
        },
        description: rec.description,
        coverImage: coverUrl ? { large: coverUrl, medium: coverUrl } : undefined,
        format: rec.type,
        releaseYear: Number.isNaN(releaseYear) ? undefined : releaseYear,
        url: `https://www.mangaupdates.com/series/${rec.series_id}`,
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
      const rec = await this.fetchJson<{
        series_id: number;
        title: string;
        description?: string;
        year?: string;
        type?: string;
        image?: { url?: { original?: string; thumb?: string } };
      }>(`${MangaUpdatesAdapter.BASE_URL}/series/${numId}`, {
        headers: this.buildHeaders(credentials),
      });

      if (!rec?.series_id) return null;
      const releaseYear = rec.year ? parseInt(rec.year, 10) : undefined;
      const coverUrl = rec.image?.url?.original || rec.image?.url?.thumb;

      return {
        id: String(rec.series_id),
        externalId: String(rec.series_id),
        provider: "MANGAUPDATES",
        mediaType: "MANGA",
        title: {
          userPreferred: rec.title,
          english: rec.title,
        },
        description: rec.description,
        coverImage: coverUrl ? { large: coverUrl, medium: coverUrl } : undefined,
        format: rec.type,
        releaseYear: Number.isNaN(releaseYear) ? undefined : releaseYear,
        url: `https://www.mangaupdates.com/series/${rec.series_id}`,
      };
    } catch {
      return null;
    }
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    _options?: { type?: string }
  ): Promise<LibraryItem[]> {
    const activeCreds = { ...credentials };
    let token = this.getSessionToken(activeCreds);
    if (!token && activeCreds.username && activeCreds.password) {
      const login = await this.loginWithCredentials(activeCreds.username, activeCreds.password);
      token = login.sessionToken;
      activeCreds.accessToken = token;
      activeCreds.apiKey = token;
    }

    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaUpdates session token for library sync",
        this.provider
      );
    }

    const res = await this.fetchJson<{
      total_hits: number;
      results: Array<{
        record: {
          series: {
            id: number;
            title: string;
          };
          list_id: number;
          status: {
            volume?: number;
            chapter?: number;
          };
          priority?: number;
        };
      }>;
    }>(`${MangaUpdatesAdapter.BASE_URL}/lists/series`, {
      headers: {
        "User-Agent": MangaUpdatesAdapter.USER_AGENT,
        Authorization: `Bearer ${token}`,
      },
    });

    const listMap: Record<number, LibraryItem["status"]> = {
      0: "IN_PROGRESS", // Reading
      1: "PLANNED",     // Wish List
      2: "COMPLETED",   // Complete
      3: "DROPPED",     // Unfinished
      4: "ON_HOLD",     // On Hold
    };

    return (res.results || []).map((entry) => {
      const rec = entry.record;
      return {
        id: String(rec.series.id),
        externalId: String(rec.series.id),
        provider: "MANGAUPDATES",
        mediaType: "MANGA",
        title: rec.series.title,
        status: listMap[rec.list_id] || "IN_PROGRESS",
        progress: rec.status?.chapter ?? 0,
        progressVolumes: rec.status?.volume,
      };
    });
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    const activeCreds = { ...credentials };
    let token = this.getSessionToken(activeCreds);
    if (!token && activeCreds.username && activeCreds.password) {
      const login = await this.loginWithCredentials(activeCreds.username, activeCreds.password);
      token = login.sessionToken;
      activeCreds.accessToken = token;
      activeCreds.apiKey = token;
    }

    if (!token) {
      throw new ConnectionAuthError(
        "Missing MangaUpdates session token for entry update",
        this.provider
      );
    }

    const seriesId = Number(payload.mediaId);
    if (Number.isNaN(seriesId) || seriesId <= 0) {
      throw new ConnectionError(
        `Invalid MangaUpdates series ID: ${payload.mediaId}`,
        this.provider
      );
    }

    // 0: Reading, 1: Wish List, 2: Complete, 3: Unfinished (Dropped), 4: On Hold
    let listId = 0;
    if (payload.status) {
      const s = payload.status.toUpperCase();
      switch (s) {
        case "PLANNED":
        case "PLANNING":
        case "WISH":
          listId = 1;
          break;
        case "COMPLETED":
        case "COLLECT":
          listId = 2;
          break;
        case "IN_PROGRESS":
        case "READING":
        case "WATCHING":
        case "REPEATING":
          listId = 0;
          break;
        case "ON_HOLD":
        case "PAUSED":
          listId = 4;
          break;
        case "DROPPED":
          listId = 3;
          break;
      }
    }

    const chapter = payload.progress !== undefined && payload.progress !== null ? Number(payload.progress) : 0;
    const volume = payload.extra?.volumes !== undefined ? Number(payload.extra.volumes) : 0;

    const seriesItem = {
      series: {
        id: seriesId,
      },
      list_id: listId,
      status: {
        chapter,
        volume,
      },
    };

    let listSuccess = false;
    try {
      await this.fetchJson(`${MangaUpdatesAdapter.BASE_URL}/lists/series/update`, {
        method: "POST",
        headers: {
          "User-Agent": MangaUpdatesAdapter.USER_AGENT,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify([seriesItem]),
      });
      listSuccess = true;
    } catch (err: unknown) {
      const errStr = String(err);
      if (
        errStr.includes("That series isn't on your list") ||
        errStr.includes("isn't on your list") ||
        errStr.includes("All series updates failed")
      ) {
        // Automatically add to list if not present
        await this.fetchJson(`${MangaUpdatesAdapter.BASE_URL}/lists/series`, {
          method: "POST",
          headers: {
            "User-Agent": MangaUpdatesAdapter.USER_AGENT,
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify([seriesItem]),
        });
        listSuccess = true;
      } else {
        throw err;
      }
    }

    // Update user series rating if score is provided (MangaUpdates uses 1-10 rating scale)
    if (listSuccess && payload.score !== undefined && payload.score !== null) {
      const numScore = Number(payload.score);
      if (numScore > 0) {
        const normalized = numScore > 10 ? Math.round(numScore / 10) : Math.round(numScore);
        if (normalized >= 1 && normalized <= 10) {
          try {
            await this.fetchJson(`${MangaUpdatesAdapter.BASE_URL}/series/${seriesId}/rating`, {
              method: "PUT",
              headers: {
                "User-Agent": MangaUpdatesAdapter.USER_AGENT,
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ rating: normalized }),
            });
          } catch {
            // Non-fatal if rating endpoint encounters minor hitch
          }
        }
      }
    }

    return true;
  }
}
