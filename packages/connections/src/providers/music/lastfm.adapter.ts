import { createHash } from "node:crypto";
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
  OAuthTokens,
  ProviderCapability,
  ScrobblePayload,
} from "../../types/index.js";

export class LastFmAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "LASTFM";
  readonly category: ConnectionCategory = "MUSIC";
  readonly authType: ConnectionAuthType = "API_KEY";
  readonly iconUrl = "https://www.last.fm/static/images/favicon.702b239b6107.ico";

  readonly requiredEnvVars = ["LASTFM_API_KEY", "LASTFM_API_SECRET"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "API_KEY",
    category: "MUSIC",
    supportsOAuth: true,
    supportsApiKey: true,
    supportsCredentials: true,
    supportsSearch: false,
    supportsLibrarySync: true,
    supportsScrobble: true,
    supportsGamingLibrary: false,
  };

  private getCredentials(): { apiKey: string; apiSecret: string } {
    const apiKey = process.env.LASTFM_API_KEY?.trim();
    const apiSecret = process.env.LASTFM_API_SECRET?.trim();
    if (!apiKey || !apiSecret) {
      throw new ConnectionError(
        "Missing LASTFM_API_KEY or LASTFM_API_SECRET in environment",
        this.provider
      );
    }
    return { apiKey, apiSecret };
  }

  /**
   * Last.fm MD5 API method signature generator.
   * Parameters are ordered alphabetically by key, concatenated (key + value),
   * suffixed with the secret, and MD5 hashed.
   */
  private generateSignature(
    params: Record<string, string | number>,
    secret: string
  ): string {
    const sortedKeys = Object.keys(params)
      .filter((k) => k !== "format" && k !== "callback" && k !== "api_sig")
      .sort();

    let sigStr = "";
    for (const k of sortedKeys) {
      sigStr += `${k}${params[k]}`;
    }
    sigStr += secret;

    return createHash("md5").update(sigStr, "utf8").digest("hex");
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const { apiKey } = this.getCredentials();
    const state = options.state || Math.random().toString(36).substring(2);

    const url = new URL("https://www.last.fm/api/auth/");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("cb", options.redirectUri);

    return {
      url: url.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    token: string,
    _redirectUri: string
  ): Promise<OAuthTokens> {
    const { apiKey, apiSecret } = this.getCredentials();

    const params: Record<string, string> = {
      method: "auth.getSession",
      api_key: apiKey,
      token,
    };
    params.api_sig = this.generateSignature(params, apiSecret);

    const query = new URLSearchParams({ ...params, format: "json" });
    const res = await this.fetchJson<{
      session?: {
        name: string;
        key: string;
        subscriber: number;
      };
      error?: number;
      message?: string;
    }>(`https://ws.audioscrobbler.com/2.0/?${query.toString()}`);

    if (!res || !res.session || res.error) {
      throw new ConnectionAuthError(
        res?.message || "Last.fm session authorization failed",
        this.provider
      );
    }

    return {
      accessToken: res.session.key,
      username: res.session.name,
      tokenType: "SessionKey",
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const { apiKey } = this.getCredentials();
    const username =
      (credentials.username as string) ||
      (credentials as any)?.displayName ||
      (credentials.apiKey ? "user" : undefined);

    const sessionKey = credentials.accessToken || credentials.apiKey;

    const query = new URLSearchParams({
      method: "user.getInfo",
      api_key: apiKey,
      format: "json",
      ...(username ? { user: username } : {}),
      ...(sessionKey ? { sk: sessionKey } : {}),
    });

    const res = await this.fetchJson<{
      user?: {
        name: string;
        realname?: string;
        image?: Array<{ "#text": string; size: string }>;
        url?: string;
        country?: string;
        playcount?: string;
      };
      error?: number;
      message?: string;
    }>(`https://ws.audioscrobbler.com/2.0/?${query.toString()}`);

    if (!res?.user || res.error) {
      throw new ConnectionError(
        res?.message || "Failed to fetch Last.fm user profile",
        this.provider
      );
    }

    const u = res.user;
    const avatar =
      u.image?.find((img) => img.size === "large")?.["#text"] ||
      u.image?.[0]?.["#text"];

    return {
      id: u.name,
      username: u.name,
      displayName: u.realname || u.name,
      avatarUrl: avatar,
      profileUrl: u.url || `https://www.last.fm/user/${u.name}`,
      rawMetadata: u as unknown as Record<string, unknown>,
    };
  }

  async testConnection(
    credentials: ConnectionCredentials
  ): Promise<{ ok: boolean; message?: string; profile?: ConnectionUserProfile }> {
    try {
      const profile = await this.getProfile(credentials);
      return {
        ok: true,
        message: `Connected to Last.fm as @${profile.username}`,
        profile,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: (err as Error).message || "Connection test failed",
      };
    }
  }

  async scrobble(
    credentials: ConnectionCredentials,
    payload: ScrobblePayload
  ): Promise<boolean> {
    const sessionKey = credentials.accessToken || credentials.apiKey;
    if (!sessionKey) {
      throw new ConnectionAuthError("Missing session key for Last.fm scrobble", this.provider);
    }

    const { apiKey, apiSecret } = this.getCredentials();
    const track = payload.title;
    const artist = payload.artist || (payload.extra as any)?.artist || (payload.extra as any)?.artistName || "Unknown Artist";
    const timestamp = Math.floor((payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now()) / 1000);

    const params: Record<string, string | number> = {
      method: "track.scrobble",
      api_key: apiKey,
      sk: sessionKey,
      track,
      artist,
      timestamp,
    };
    params.api_sig = this.generateSignature(params, apiSecret);

    const bodyParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      bodyParams.append(k, String(v));
    }
    bodyParams.append("format", "json");

    try {
      const res = await this.fetchJson<{ scrobbles?: any; error?: number; message?: string }>(
        "https://ws.audioscrobbler.com/2.0/",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: bodyParams.toString(),
        }
      );

      return !res?.error;
    } catch {
      return false;
    }
  }

  async getLibrary(
    credentials: ConnectionCredentials
  ): Promise<LibraryItem[]> {
    const sessionKey = credentials.accessToken || credentials.apiKey;
    const username = (credentials.username as string) || (credentials as any)?.displayName;
    if (!username && !sessionKey) return [];

    const { apiKey } = this.getCredentials();
    const query = new URLSearchParams({
      method: "user.getTopTracks",
      api_key: apiKey,
      format: "json",
      limit: "50",
      ...(username ? { user: username } : {}),
      ...(sessionKey ? { sk: sessionKey } : {}),
    });

    try {
      const res = await this.fetchJson<{
        toptracks?: {
          track?: Array<{
            name: string;
            playcount: string;
            artist?: { name: string };
            url: string;
          }>;
        };
      }>(`https://ws.audioscrobbler.com/2.0/?${query.toString()}`);

      const tracks = res?.toptracks?.track || [];
      return tracks.map((t, idx) => ({
        id: `${t.artist?.name || ""}:::${t.name}`,
        externalId: `${t.artist?.name || ""}:::${t.name}`,
        provider: "LASTFM",
        mediaType: "MUSIC",
        title: `${t.name} - ${t.artist?.name || ""}`,
        status: "COMPLETED",
        progress: parseInt(t.playcount, 10) || idx + 1,
        updatedAt: new Date(),
      }));
    } catch {
      return [];
    }
  }
}
