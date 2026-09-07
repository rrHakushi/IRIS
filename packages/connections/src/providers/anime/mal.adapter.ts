import { randomBytes } from "node:crypto";
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

export class MyAnimeListAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "MAL";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "https://cdn.simpleicons.org/myanimelist/2E51A2";

  readonly requiredEnvVars = ["MAL_CLIENT_ID"] as const;
  readonly optionalEnvVars = ["MAL_CLIENT_SECRET"] as const;

  readonly capabilities: ProviderCapability = {
    authType: "OAUTH2",
    category: "TRACKING",
    supportsOAuth: true,
    supportsApiKey: false,
    supportsCredentials: false,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: true,
    supportsGamingLibrary: false,
  };

  private getClientId(): string {
    return process.env.MAL_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.MAL_CLIENT_SECRET || "";
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    const state = options.state || Math.random().toString(36).substring(2);
    // MAL requires code_verifier to be 43-128 chars, and for "plain", code_challenge == code_verifier
    const codeVerifier =
      options.codeVerifier ||
      randomBytes(48).toString("base64url").slice(0, 64);
    const codeChallenge = codeVerifier;

    const url = new URL("https://myanimelist.net/v1/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "plain");

    return {
      url: url.toString(),
      state,
      codeVerifier,
    };
  }

  async exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier || "",
    });

    if (clientSecret) {
      bodyParams.set("client_secret", clientSecret);
    }

    const res = await this.fetchJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    }>("https://myanimelist.net/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 2678400) * 1000);

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      tokenType: res.token_type || "Bearer",
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const bodyParams = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    if (clientSecret) {
      bodyParams.set("client_secret", clientSecret);
    }

    const res = await this.fetchJson<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    }>("https://myanimelist.net/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 2678400) * 1000);

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
    if (!credentials.accessToken) {
      throw new ConnectionAuthError("Missing access token for MyAnimeList", this.provider);
    }

    const data = await this.fetchJson<{
      id: number;
      name: string;
      picture?: string;
      location?: string;
      joined_at?: string;
    }>("https://api.myanimelist.net/v2/users/@me", {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });

    return {
      id: String(data.id),
      username: data.name,
      displayName: data.name,
      avatarUrl: data.picture,
      profileUrl: `https://myanimelist.net/profile/${data.name}`,
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
        message: (err as Error).message || "MyAnimeList connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const headers: Record<string, string> = {};
    if (credentials?.accessToken) {
      headers["Authorization"] = `Bearer ${credentials.accessToken}`;
    } else {
      headers["X-MAL-CLIENT-ID"] = this.getClientId();
    }

    const mediaType = options?.type === "MANGA" ? "manga" : "anime";
    const limit = options?.perPage || 20;
    const offset = ((options?.page || 1) - 1) * limit;

    const fields =
      mediaType === "anime"
        ? "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_episodes,status,genres,media_type"
        : "id,title,main_picture,alternative_titles,start_date,end_date,synopsis,mean,rank,popularity,num_volumes,num_chapters,status,genres,media_type";

    const url = new URL(`https://api.myanimelist.net/v2/${mediaType}`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("fields", fields);

    const data = await this.fetchJson<{
      data: Array<{
        node: {
          id: number;
          title: string;
          main_picture?: { medium?: string; large?: string };
          alternative_titles?: { en?: string; ja?: string; synonyms?: string[] };
          synopsis?: string;
          mean?: number;
          popularity?: number;
          num_episodes?: number;
          num_chapters?: number;
          num_volumes?: number;
          status?: string;
          genres?: Array<{ id: number; name: string }>;
          media_type?: string;
          start_date?: string;
        };
      }>;
    }>(url.toString(), { headers });

    return (data.data || []).map(({ node }) => ({
      id: String(node.id),
      externalId: String(node.id),
      provider: "MAL",
      mediaType: mediaType === "manga" ? "MANGA" : "ANIME",
      title: {
        userPreferred: node.title,
        english: node.alternative_titles?.en,
        native: node.alternative_titles?.ja,
      },
      description: node.synopsis,
      coverImage: {
        large: node.main_picture?.large || node.main_picture?.medium,
        medium: node.main_picture?.medium,
      },
      format: node.media_type?.toUpperCase(),
      status: node.status?.toUpperCase(),
      episodes: node.num_episodes,
      chapters: node.num_chapters,
      volumes: node.num_volumes,
      averageScore: node.mean ? Math.round(node.mean * 10) : undefined,
      popularity: node.popularity,
      releaseYear: node.start_date ? parseInt(node.start_date.substring(0, 4), 10) : undefined,
      genres: node.genres?.map((g) => g.name),
      url: `https://myanimelist.net/${mediaType}/${node.id}`,
    }));
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    options?: { type?: string }
  ): Promise<LibraryItem[]> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError("Missing access token for MyAnimeList", this.provider);
    }

    const isManga = options?.type === "MANGA";
    const endpoint = isManga ? "mangalist" : "animelist";
    const fields = isManga
      ? "list_status{status,score,num_volumes_read,num_chapters_read,is_rereading,updated_at,comments},num_chapters,num_volumes"
      : "list_status{status,score,num_episodes_watched,is_rewatching,updated_at,comments},num_episodes";

    const url = new URL(`https://api.myanimelist.net/v2/users/@me/${endpoint}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "1000");

    const data = await this.fetchJson<{
      data: Array<{
        node: {
          id: number;
          title: string;
          num_episodes?: number;
          num_chapters?: number;
          num_volumes?: number;
        };
        list_status: {
          status: string;
          score: number;
          num_episodes_watched?: number;
          num_chapters_read?: number;
          num_volumes_read?: number;
          updated_at?: string;
          comments?: string;
        };
      }>;
    }>(url.toString(), {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });

    const statusMap: Record<string, LibraryItem["status"]> = {
      watching: "CURRENT",
      reading: "CURRENT",
      completed: "COMPLETED",
      on_hold: "PAUSED",
      dropped: "DROPPED",
      plan_to_watch: "PLANNING",
      plan_to_read: "PLANNING",
    };

    return (data.data || []).map((item) => ({
      id: String(item.node.id),
      externalId: String(item.node.id),
      provider: "MAL",
      mediaType: isManga ? "MANGA" : "ANIME",
      title: item.node.title,
      status: statusMap[item.list_status.status] || "CURRENT",
      score: item.list_status.score,
      progress: isManga ? item.list_status.num_chapters_read : item.list_status.num_episodes_watched,
      progressVolumes: item.list_status.num_volumes_read,
      totalEpisodes: item.node.num_episodes,
      totalChapters: item.node.num_chapters,
      updatedAt: item.list_status.updated_at ? new Date(item.list_status.updated_at) : undefined,
      notes: item.list_status.comments,
    }));
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError(
        "Missing access token for MyAnimeList update",
        this.provider
      );
    }

    const mediaId = Number(payload.mediaId);
    if (Number.isNaN(mediaId) || mediaId <= 0) {
      throw new ConnectionError(
        `Invalid MyAnimeList media ID: ${payload.mediaId}`,
        this.provider
      );
    }

    const isManga = payload.mediaType === "MANGA";
    const endpoint = isManga ? "manga" : "anime";

    let malStatus: string | undefined;
    if (payload.status) {
      const s = payload.status.toUpperCase();
      switch (s) {
        case "WATCHING":
        case "REPEATING":
          malStatus = isManga ? "reading" : "watching";
          break;
        case "COMPLETED":
          malStatus = "completed";
          break;
        case "PAUSED":
        case "ON_HOLD":
        case "HOLD":
          malStatus = "on_hold";
          break;
        case "DROPPED":
          malStatus = "dropped";
          break;
        case "PLANNING":
        case "PLAN_TO_WATCH":
        case "PLAN_TO_READ":
          malStatus = isManga ? "plan_to_read" : "plan_to_watch";
          break;
        default:
          malStatus = isManga ? "reading" : "watching";
          break;
      }
    }

    const bodyParams = new URLSearchParams();
    if (malStatus) {
      bodyParams.set("status", malStatus);
    }
    if (payload.score !== undefined && payload.score !== null) {
      const score = Math.min(10, Math.max(0, Math.round(Number(payload.score))));
      bodyParams.set("score", String(score));
    }
    if (payload.progress !== undefined && payload.progress !== null) {
      const progressKey = isManga ? "num_chapters_read" : "num_watched_episodes";
      bodyParams.set(progressKey, String(payload.progress));
    }
    if (payload.status === "REPEATING") {
      bodyParams.set(isManga ? "is_rereading" : "is_rewatching", "true");
    }
    if (payload.rewatched !== undefined && payload.rewatched !== null) {
      bodyParams.set(
        isManga ? "num_times_reread" : "num_times_rewatched",
        String(payload.rewatched)
      );
    }
    if (payload.notes !== undefined && payload.notes !== null) {
      bodyParams.set("comments", String(payload.notes));
    }

    const toMalDate = (d?: Date | string | null) => {
      if (!d) return undefined;
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return undefined;
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    };

    const start = toMalDate(payload.startedAt);
    if (start) bodyParams.set("start_date", start);
    const finish = toMalDate(payload.completedAt);
    if (finish) bodyParams.set("finish_date", finish);

    const url = `https://api.myanimelist.net/v2/${endpoint}/${mediaId}/my_list_status`;
    await this.fetchJson(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    return true;
  }
}
