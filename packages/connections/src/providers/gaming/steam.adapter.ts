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
  GameItem,
  GamingProfile,
  OAuthTokens,
  ProviderCapability,
} from "../../types/index.js";

export class SteamAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "STEAM";
  readonly category: ConnectionCategory = "GAMING";
  readonly authType: ConnectionAuthType = "OPENID";
  readonly iconUrl = "https://cdn.simpleicons.org/steam/ffffff";
  readonly requiredEnvVars = ["STEAM_API_KEY"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "OPENID",
    category: "GAMING",
    supportsOAuth: true,
    supportsApiKey: true,
    supportsCredentials: true,
    supportsSearch: false,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: true,
  };

  private getSteamApiKey(): string {
    return process.env.STEAM_API_KEY || "";
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const state = options.state || Math.random().toString(36).substring(2);
    const returnTo = new URL(options.redirectUri);
    returnTo.searchParams.set("state", state);

    const openIdUrl = new URL("https://steamcommunity.com/openid/login");
    openIdUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
    openIdUrl.searchParams.set("openid.mode", "checkid_setup");
    openIdUrl.searchParams.set("openid.return_to", returnTo.toString());
    openIdUrl.searchParams.set("openid.realm", returnTo.origin);
    openIdUrl.searchParams.set(
      "openid.identity",
      "http://specs.openid.net/auth/2.0/identifier_select"
    );
    openIdUrl.searchParams.set(
      "openid.claimed_id",
      "http://specs.openid.net/auth/2.0/identifier_select"
    );

    return {
      url: openIdUrl.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    claimedIdOrCode: string,
    _redirectUri: string
  ): Promise<OAuthTokens> {
    // Extract 64-bit Steam ID from OpenID claimed_id URL (e.g. https://steamcommunity.com/openid/id/76561198000000000)
    let steamId = claimedIdOrCode;
    const match = claimedIdOrCode.match(/\/openid\/id\/(\d+)/);
    if (match && match[1]) {
      steamId = match[1];
    }

    return {
      accessToken: steamId, // store SteamID64
      tokenType: "SteamOpenID",
      steamId,
    };
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const steamId = credentials.accessToken || credentials.apiKey || (credentials as any).steamId;
    const apiKey = credentials.apiKey || this.getSteamApiKey();

    if (!steamId) {
      throw new ConnectionAuthError("Missing Steam ID in credentials", this.provider);
    }

    if (!apiKey) {
      // Return bare-minimum if no server API key configured
      return {
        id: steamId,
        username: `SteamUser_${steamId.slice(-6)}`,
        displayName: `Steam User (${steamId})`,
        profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
      };
    }

    const res = await this.fetchJson<{
      response: {
        players: Array<{
          steamid: string;
          personaname: string;
          profileurl: string;
          avatar: string;
          avatarmedium: string;
          avatarfull: string;
          personastate: number;
          realname?: string;
        }>;
      };
    }>(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
    );

    const player = res.response?.players?.[0];
    if (!player) {
      throw new ConnectionAuthError(`Steam user with ID ${steamId} not found`, this.provider);
    }

    return {
      id: player.steamid,
      username: player.personaname,
      displayName: player.personaname,
      avatarUrl: player.avatarfull || player.avatarmedium,
      profileUrl: player.profileurl,
      rawMetadata: {
        personaState: player.personastate,
        realname: player.realname,
      },
    };
  }

  async getGamingProfile(
    credentials: ConnectionCredentials
  ): Promise<GamingProfile> {
    const profile = await this.getProfile(credentials);
    const steamId = credentials.accessToken || credentials.apiKey || (credentials as any).steamId;
    const apiKey = credentials.apiKey || this.getSteamApiKey();

    let gameCount = 0;
    if (apiKey && steamId) {
      try {
        const gamesRes = await this.fetchJson<{
          response: { game_count: number };
        }>(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=false`
        );
        gameCount = gamesRes.response?.game_count || 0;
      } catch {}
    }

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileUrl: profile.profileUrl,
      gameCount,
      isOnline: (profile.rawMetadata as any)?.personaState > 0,
    };
  }

  async getGames(credentials: ConnectionCredentials): Promise<GameItem[]> {
    const steamId = credentials.accessToken || credentials.apiKey || (credentials as any).steamId;
    const apiKey = credentials.apiKey || this.getSteamApiKey();

    if (!steamId || !apiKey) {
      return [];
    }

    const res = await this.fetchJson<{
      response: {
        game_count: number;
        games: Array<{
          appid: number;
          name: string;
          playtime_forever: number; // in minutes
          playtime_2weeks?: number;
          img_icon_url?: string;
          rtime_last_played?: number;
        }>;
      };
    }>(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`
    );

    return (res.response?.games || []).map((game) => ({
      id: String(game.appid),
      externalId: String(game.appid),
      name: game.name,
      iconUrl: game.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
        : undefined,
      headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      playtimeMinutes: game.playtime_forever,
      playtime2WeeksMinutes: game.playtime_2weeks,
      lastPlayedAt: game.rtime_last_played
        ? new Date(game.rtime_last_played * 1000)
        : null,
    }));
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
        message: (err as Error).message || "Steam connection test failed",
      };
    }
  }
}
