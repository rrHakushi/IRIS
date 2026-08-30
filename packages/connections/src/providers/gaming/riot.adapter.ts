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
  GamingProfile,
  OAuthTokens,
  ProviderCapability,
} from "../../types/index.js";

export class RiotGamesAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "RIOT_GAMES";
  readonly category: ConnectionCategory = "GAMING";
  readonly iconUrl = "https://cdn.simpleicons.org/riotgames/D13639";
  readonly requiredEnvVars = [] as const;
  readonly optionalEnvVars = ["RIOT_API_KEY", "RIOT_CLIENT_ID", "RIOT_CLIENT_SECRET"] as const;

  get authType(): ConnectionAuthType {
    const hasOAuth = Boolean(process.env.RIOT_CLIENT_ID && process.env.RIOT_CLIENT_SECRET);
    return hasOAuth ? "OAUTH2" : "API_KEY";
  }

  get capabilities(): ProviderCapability {
    const hasOAuth = Boolean(process.env.RIOT_CLIENT_ID && process.env.RIOT_CLIENT_SECRET);
    return {
      authType: hasOAuth ? "OAUTH2" : "API_KEY",
      category: "GAMING",
      supportsOAuth: hasOAuth,
      supportsApiKey: true,
      supportsCredentials: true,
      supportsSearch: false,
      supportsLibrarySync: false,
      supportsScrobble: false,
      supportsGamingLibrary: true,
    };
  }

  override isConfigured(): boolean {
    const hasOAuth = Boolean(process.env.RIOT_CLIENT_ID && process.env.RIOT_CLIENT_SECRET);
    const hasApiKey = Boolean(process.env.RIOT_API_KEY);
    return hasOAuth || hasApiKey;
  }

  override getMissingEnvVars(): string[] {
    if (this.isConfigured()) return [];
    return ["RIOT_API_KEY or (RIOT_CLIENT_ID & RIOT_CLIENT_SECRET)"];
  }

  private getClientId(): string {
    return process.env.RIOT_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.RIOT_CLIENT_SECRET || "";
  }

  private getApiKey(): string {
    return process.env.RIOT_API_KEY || "";
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    const state = options.state || Math.random().toString(36).substring(2);
    const url = new URL("https://auth.riotgames.com/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("scope", "openid cpid offline_access");
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
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const res = await this.fetchJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      id_token?: string;
    }>("https://auth.riotgames.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 3600) * 1000);

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      idToken: res.id_token,
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const token = credentials.accessToken;
    const apiKey = credentials.apiKey || this.getApiKey();

    if (token) {
      const userinfo = await this.fetchJson<{
        sub: string;
        cpid?: string;
        acct?: { game_name: string; tag_line: string };
      }>("https://auth.riotgames.com/userinfo", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const gameName = userinfo.acct?.game_name || "Riot Player";
      const tagLine = userinfo.acct?.tag_line || "0000";

      return {
        id: userinfo.sub,
        username: `${gameName}#${tagLine}`,
        displayName: `${gameName}#${tagLine}`,
        rawMetadata: userinfo as unknown as Record<string, unknown>,
      };
    }

    if (credentials.username && apiKey) {
      // Lookup by Riot ID (gameName / tagLine)
      const [gameName, tagLine] = credentials.username.split("#");
      if (!gameName || !tagLine) {
        throw new ConnectionAuthError("Riot username format must be Name#Tag", this.provider);
      }

      const res = await this.fetchJson<{
        puuid: string;
        gameName: string;
        tagLine: string;
      }>(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        {
          headers: {
            "X-Riot-Token": apiKey,
          },
        }
      );

      return {
        id: res.puuid,
        username: `${res.gameName}#${res.tagLine}`,
        displayName: `${res.gameName}#${res.tagLine}`,
      };
    }

    throw new ConnectionAuthError("Missing Riot Games credentials", this.provider);
  }

  async getGamingProfile(
    credentials: ConnectionCredentials
  ): Promise<GamingProfile> {
    const profile = await this.getProfile(credentials);
    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(profile.username)}`,
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
        message: (err as Error).message || "Riot Games connection test failed",
      };
    }
  }
}
