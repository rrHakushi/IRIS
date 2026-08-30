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
    return process.env.SIMKL_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.SIMKL_CLIENT_SECRET || "";
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
    const type = options?.type === "MOVIE" ? "movies" : options?.type === "TV" ? "tv" : "anime";

    const url = new URL(`https://api.simkl.com/search/${type}`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(options?.perPage || 20));
    url.searchParams.set("extended", "full");

    const headers: Record<string, string> = {
      "simkl-api-key": clientId,
    };

    if (credentials?.accessToken) {
      headers["Authorization"] = `Bearer ${credentials.accessToken}`;
    }

    const items = await this.fetchJson<
      Array<{
        title: string;
        year?: number;
        poster?: string;
        fanart?: string;
        overview?: string;
        ids: {
          simkl: number;
          slug?: string;
          mal?: string;
          anilist?: string;
          imdb?: string;
          tmdb?: string;
        };
      }>
    >(url.toString(), { headers });

    return (items || []).map((item) => ({
      id: String(item.ids.simkl),
      externalId: String(item.ids.simkl),
      provider: "SIMKL",
      mediaType: type === "movies" ? "MOVIE" : type === "tv" ? "TV" : "ANIME",
      title: {
        userPreferred: item.title,
      },
      description: item.overview,
      coverImage: {
        large: item.poster ? `https://simkl.in/posters/${item.poster}_m.jpg` : undefined,
      },
      bannerImage: item.fanart ? `https://simkl.in/fanart/${item.fanart}_medium.jpg` : undefined,
      releaseYear: item.year,
      url: `https://simkl.com/${type}/${item.ids.simkl}`,
    }));
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
