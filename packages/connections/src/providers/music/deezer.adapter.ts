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
} from "../../types/index.js";

interface DeezerTokenResponse {
  access_token: string;
  expires?: number;
  error_reason?: string;
}

interface DeezerUserResponse {
  id: number | string;
  name: string;
  email?: string;
  link?: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  status?: number;
}

export class DeezerAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "DEEZER";
  readonly category: ConnectionCategory = "MUSIC";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "https://e-cdns-files.dzcdn.net/img/common/favicon/favicon.ico";

  readonly requiredEnvVars = ["DEEZER_APP_ID", "DEEZER_APP_SECRET"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "MUSIC",
    supportsOAuth: true,
    supportsApiKey: false,
    supportsCredentials: false,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: false,
  };

  private getAppCredentials(): { appId: string; appSecret: string } {
    const appId = process.env.DEEZER_APP_ID?.trim();
    const appSecret = process.env.DEEZER_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new ConnectionError(
        "Missing DEEZER_APP_ID or DEEZER_APP_SECRET in environment",
        this.provider
      );
    }
    return { appId, appSecret };
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const { appId } = this.getAppCredentials();
    const perms = "basic_access,email,offline_access,manage_library,listening_history";
    const state = options.state || Math.random().toString(36).substring(2);

    const url = new URL("https://connect.deezer.com/oauth/auth.php");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("perms", perms);
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
    const { appId, appSecret } = this.getAppCredentials();

    const tokenUrl = new URL("https://connect.deezer.com/oauth/access_token.php");
    tokenUrl.searchParams.set("app_id", appId);
    tokenUrl.searchParams.set("secret", appSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("output", "json");

    const res = await this.fetchJson<DeezerTokenResponse>(tokenUrl.toString(), {
      method: "GET",
    });

    if (!res || !res.access_token || res.error_reason) {
      throw new ConnectionAuthError(
        res?.error_reason || "Deezer token exchange failed",
        this.provider
      );
    }

    const expiresAt =
      res.expires && res.expires > 0
        ? new Date(Date.now() + res.expires * 1000)
        : null;

    return {
      accessToken: res.access_token,
      expiresAt,
      tokenType: "Bearer",
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError("Missing access token for Deezer profile", this.provider);
    }

    const user = await this.fetchJson<DeezerUserResponse>(
      `https://api.deezer.com/user/me?access_token=${encodeURIComponent(credentials.accessToken)}`
    );

    if (!user || !user.id) {
      throw new ConnectionError("Failed to fetch Deezer user profile", this.provider);
    }

    return {
      id: String(user.id),
      username: user.name,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.picture_medium || user.picture_big || user.picture,
      profileUrl: user.link || `https://www.deezer.com/profile/${user.id}`,
      rawMetadata: user as unknown as Record<string, unknown>,
    };
  }

  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile }> {
    try {
      const profile = await this.getProfile(credentials);
      return {
        ok: true,
        message: `Connected to Deezer as ${profile.displayName}`,
        profile,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: (err as Error).message || "Connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const limit = options?.perPage || 20;
    const url = new URL("https://api.deezer.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const res = await this.fetchJson<{
      data?: Array<{
        id: number;
        title: string;
        link: string;
        duration: number;
        artist: { id: number; name: string };
        album: { id: number; title: string; cover_medium?: string };
      }>;
    }>(url.toString());

    if (!res.data || !Array.isArray(res.data)) return [];

    return res.data.map((t) => ({
      id: String(t.id),
      externalId: String(t.id),
      provider: "DEEZER",
      mediaType: "MUSIC",
      title: {
        userPreferred: t.title,
        english: t.title,
      },
      coverImage: {
        medium: t.album?.cover_medium,
      },
      url: t.link,
    }));
  }

  async getLibrary(
    credentials: ConnectionCredentials
  ): Promise<LibraryItem[]> {
    if (!credentials.accessToken) return [];

    const url = `https://api.deezer.com/user/me/playlists?access_token=${encodeURIComponent(
      credentials.accessToken
    )}&limit=100`;

    const res = await this.fetchJson<{
      data?: Array<{
        id: number;
        title: string;
        description?: string;
        nb_tracks: number;
        link?: string;
        picture_medium?: string;
      }>;
    }>(url);

    if (!res.data || !Array.isArray(res.data)) return [];

    return res.data.map((pl) => ({
      id: String(pl.id),
      externalId: String(pl.id),
      provider: "DEEZER",
      mediaType: "MUSIC",
      title: pl.title,
      status: "COMPLETED",
      progress: pl.nb_tracks,
      score: undefined,
      updatedAt: new Date(),
    }));
  }
}
