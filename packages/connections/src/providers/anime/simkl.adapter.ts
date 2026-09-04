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
  MediaSearchResult,
  OAuthTokens,
  ProviderCapability,
  ScrobblePayload,
  SearchOptions,
} from "../../types/index.js";

export class SimklAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "SIMKL";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "https://cdn.simpleicons.org/simkl/00ADEF";

  readonly requiredEnvVars = ["SIMKL_CLIENT_ID", "SIMKL_CLIENT_SECRET"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "TRACKING",
    supportsOAuth: true,
    supportsApiKey: true,
    supportsCredentials: false,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: true,
    supportsGamingLibrary: false,
  };

  private getClientId(): string {
    const raw = process.env.SIMKL_CLIENT_ID || "";
    return raw.trim().replace(/^["']|["']$/g, "").trim();
  }

  private getClientSecret(): string {
    const raw = process.env.SIMKL_CLIENT_SECRET || "";
    return raw.trim().replace(/^["']|["']$/g, "").trim();
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    const state = options.state || Math.random().toString(36).substring(2);
    const url = new URL("https://simkl.com/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
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

    const res = await this.fetchJson<{
      access_token: string;
      token_type: string;
      scope?: string;
    }>("https://api.simkl.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    return {
      accessToken: res.access_token,
      tokenType: res.token_type || "Bearer",
      scope: res.scope,
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const token = credentials.accessToken;
    const clientId = this.getClientId();

    if (!token) {
      throw new ConnectionAuthError("Missing access token for Simkl", this.provider);
    }

    const data = await this.fetchJson<{
      user: {
        name: string;
        avatar?: string;
        id: number;
        joined_at?: string;
      };
      account: {
        id: number;
        timezone?: string;
      };
    }>("https://api.simkl.com/users/settings", {
      headers: {
        Authorization: `Bearer ${token}`,
        "simkl-api-key": clientId,
      },
    });

    return {
      id: String(data.account?.id || data.user?.id),
      username: data.user.name,
      displayName: data.user.name,
      avatarUrl: data.user.avatar,
      profileUrl: `https://simkl.com/${data.account?.id || data.user?.id}/dashboard`,
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
        message: (err as Error).message || "Simkl connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const clientId = this.getClientId();
    const searchCategory = options?.type === "MOVIE" ? "movie" : options?.type === "TV" ? "tv" : "anime";
    const pathType = options?.type === "MOVIE" ? "movies" : options?.type === "TV" ? "tv" : "anime";
    const mediaType = options?.type === "MOVIE" ? "MOVIE" : options?.type === "TV" ? "TV" : "ANIME";

    const fetchCategory = async (type: string) => {
      const url = new URL(`https://api.simkl.com/search/${type}`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(options?.perPage || 20));
      url.searchParams.set("extended", "full");
      if (clientId) {
        url.searchParams.set("client_id", clientId);
      }

      const headers: Record<string, string> = {};
      if (clientId) {
        headers["simkl-api-key"] = clientId;
      }

      if (credentials?.accessToken) {
        headers["Authorization"] = `Bearer ${credentials.accessToken}`;
      }

      const items = await this.fetchJson<any[]>(url.toString(), { headers });
      return Array.isArray(items) ? items : [];
    };

    let items = await fetchCategory(searchCategory);

    // Fallback: If searching "anime" yields no results, also check "tv" in case the entry is under TV
    if (items.length === 0 && searchCategory === "anime") {
      try {
        const tvItems = await fetchCategory("tv");
        if (tvItems.length > 0) {
          items = tvItems;
        }
      } catch {
        // Ignore fallback errors
      }
    }

    return items.map((item: any) => {
      const simklId =
        item.ids?.simkl_id ??
        item.ids?.simkl ??
        item.ids?.id ??
        item.simkl_id ??
        item.simkl ??
        item.id;

      let validId =
        simklId != null &&
        String(simklId) !== "undefined" &&
        String(simklId) !== "null"
          ? String(simklId)
          : "";

      if (!validId && item.ids?.slug) {
        const slugMatch = String(item.ids.slug).match(/-(\d+)$/);
        if (slugMatch && slugMatch[1]) {
          validId = slugMatch[1];
        } else {
          validId = String(item.ids.slug);
        }
      }

      if (!validId && item.url) {
        const urlMatch = String(item.url).match(/\/(\d+)(?:\/|$)/);
        if (urlMatch && urlMatch[1]) {
          validId = urlMatch[1];
        }
      }

      const primaryTitle =
        item.title_en ||
        item.title ||
        item.title_romaji ||
        "Untitled";

      return {
        id: validId || undefined,
        externalId: validId,
        provider: "SIMKL",
        mediaType,
        title: {
          userPreferred: primaryTitle,
          english: item.title_en,
          romaji: item.title_romaji || item.title,
        },
        description: item.overview,
        coverImage: {
          large: item.poster ? `https://simkl.in/posters/${item.poster}_m.jpg` : undefined,
        },
        bannerImage: item.fanart ? `https://simkl.in/fanart/${item.fanart}_medium.jpg` : undefined,
        releaseYear: item.year,
        format: item.type ? String(item.type).toUpperCase() : undefined,
        episodes: item.ep_count ?? undefined,
        url: validId
          ? `https://simkl.com/${pathType}/${validId}`
          : item.url
            ? `https://simkl.com${item.url}`
            : undefined,
      };
    });
  }

  async getMediaById(
    externalId: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const clientId = this.getClientId();
    const primaryType = options?.type === "MOVIE" ? "movies" : options?.type === "TV" ? "tv" : "anime";
    const url = new URL(`https://api.simkl.com/${primaryType}/${externalId}`);
    url.searchParams.set("extended", "full");
    if (clientId) {
      url.searchParams.set("client_id", clientId);
    }

    const headers: Record<string, string> = {};
    if (clientId) {
      headers["simkl-api-key"] = clientId;
    }
    if (credentials?.accessToken) {
      headers["Authorization"] = `Bearer ${credentials.accessToken}`;
    }

    try {
      const item = await this.fetchJson<any>(url.toString(), { headers });
      if (!item || item.error) return null;

      const simklId =
        item.ids?.simkl_id ??
        item.ids?.simkl ??
        item.ids?.id ??
        item.simkl_id ??
        item.simkl ??
        item.id ??
        externalId;

      const primaryTitle =
        item.title_en ||
        item.title ||
        item.title_romaji ||
        "Untitled";

      return {
        id: String(simklId),
        externalId: String(simklId),
        provider: "SIMKL",
        mediaType: primaryType === "movies" ? "MOVIE" : primaryType === "tv" ? "TV" : "ANIME",
        title: {
          userPreferred: primaryTitle,
          english: item.title_en,
          romaji: item.title_romaji || item.title,
        },
        description: item.overview,
        coverImage: {
          large: item.poster ? `https://simkl.in/posters/${item.poster}_m.jpg` : undefined,
        },
        bannerImage: item.fanart ? `https://simkl.in/fanart/${item.fanart}_medium.jpg` : undefined,
        releaseYear: item.year,
        format: item.type ? String(item.type).toUpperCase() : undefined,
        episodes: item.ep_count ?? undefined,
        url: `https://simkl.com/${primaryType}/${simklId}`,
      };
    } catch {
      return null;
    }
  }

  async scrobble(
    credentials: ConnectionCredentials,
    payload: ScrobblePayload
  ): Promise<boolean> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError("Missing access token for Simkl scrobble", this.provider);
    }

    const clientId = this.getClientId();
    const isMovie = payload.mediaType === "MOVIE";

    const body: Record<string, unknown> = isMovie
      ? {
          movies: [{ title: payload.title, year: payload.year }],
        }
      : {
          shows: [
            {
              title: payload.title,
              year: payload.year,
              seasons: [
                {
                  number: payload.seasonNumber || 1,
                  episodes: [{ number: payload.episodeNumber || 1 }],
                },
              ],
            },
          ],
        };

    await this.fetchJson("https://api.simkl.com/sync/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "simkl-api-key": clientId,
      },
      body: JSON.stringify(body),
    });

    return true;
  }
}
