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

export class AniListAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "ANILIST";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "https://cdn.simpleicons.org/anilist/02A9FF";

  readonly requiredEnvVars = ["ANILIST_CLIENT_ID", "ANILIST_CLIENT_SECRET"] as const;

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
    return process.env.ANILIST_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.ANILIST_CLIENT_SECRET || "";
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    const state = options.state || Math.random().toString(36).substring(2);
    const url = new URL("https://anilist.co/api/v2/oauth/authorize");
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

    const res = await this.fetchJson<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>("https://anilist.co/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 31536000) * 1000);

    return {
      accessToken: res.access_token,
      tokenType: res.token_type || "Bearer",
      expiresAt,
    };
  }

  private async executeGraphQL<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    accessToken?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await this.fetchJson<{ data?: T; errors?: Array<{ message: string }> }>(
      "https://graphql.anilist.co",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
      }
    );

    if (res.errors && res.errors.length > 0) {
      throw new ConnectionAuthError(
        res.errors[0]?.message || "AniList GraphQL query error",
        this.provider
      );
    }

    return res.data as T;
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const query = `
      query {
        Viewer {
          id
          name
          avatar {
            large
            medium
          }
          siteUrl
        }
      }
    `;

    const data = await this.executeGraphQL<{
      Viewer: {
        id: number;
        name: string;
        avatar?: { large?: string; medium?: string };
        siteUrl?: string;
      };
    }>(query, {}, credentials.accessToken);

    if (!data?.Viewer) {
      throw new ConnectionAuthError("Failed to fetch Viewer from AniList", this.provider);
    }

    return {
      id: String(data.Viewer.id),
      username: data.Viewer.name,
      displayName: data.Viewer.name,
      avatarUrl: data.Viewer.avatar?.large || data.Viewer.avatar?.medium,
      profileUrl: data.Viewer.siteUrl || `https://anilist.co/user/${data.Viewer.name}`,
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
        message: (err as Error).message || "AniList connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    const gql = `
      query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: $type, sort: POPULARITY_DESC) {
            id
            idMal
            type
            format
            status
            episodes
            chapters
            volumes
            duration
            averageScore
            popularity
            seasonYear
            genres
            siteUrl
            title {
              userPreferred
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            description(asHtml: false)
          }
        }
      }
    `;

    const type = options?.type === "MANGA" || options?.type === "BOOK" ? "MANGA" : "ANIME";
    const data = await this.executeGraphQL<{
      Page: {
        media: Array<{
          id: number;
          idMal?: number;
          type: string;
          format?: string;
          status?: string;
          episodes?: number;
          chapters?: number;
          volumes?: number;
          duration?: number;
          averageScore?: number;
          popularity?: number;
          seasonYear?: number;
          genres?: string[];
          siteUrl?: string;
          title: {
            userPreferred: string;
            romaji?: string;
            english?: string;
            native?: string;
          };
          coverImage?: {
            extraLarge?: string;
            large?: string;
            medium?: string;
            color?: string;
          };
          bannerImage?: string;
          description?: string;
        }>;
      };
    }>(
      gql,
      {
        search: query,
        type,
        page: options?.page || 1,
        perPage: options?.perPage || 20,
      },
      credentials?.accessToken
    );

    return (data?.Page?.media || []).map((item) => ({
      id: String(item.id),
      externalId: String(item.id),
      provider: "ANILIST",
      mediaType: item.type === "MANGA" ? "MANGA" : "ANIME",
      title: {
        userPreferred: item.title.userPreferred,
        romaji: item.title.romaji,
        english: item.title.english,
        native: item.title.native,
      },
      description: item.description,
      coverImage: item.coverImage,
      bannerImage: item.bannerImage,
      format: item.format,
      status: item.status,
      episodes: item.episodes,
      chapters: item.chapters,
      volumes: item.volumes,
      durationMinutes: item.duration,
      averageScore: item.averageScore,
      popularity: item.popularity,
      releaseYear: item.seasonYear,
      genres: item.genres,
      url: item.siteUrl,
    }));
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    options?: { type?: "ANIME" | "MANGA" | string }
  ): Promise<LibraryItem[]> {
    const profile = await this.getProfile(credentials);
    const type = options?.type === "MANGA" ? "MANGA" : "ANIME";

    const gql = `
      query ($userId: Int, $type: MediaType) {
        MediaListCollection(userId: $userId, type: $type) {
          lists {
            name
            status
            entries {
              id
              mediaId
              status
              score(format: POINT_10_DECIMAL)
              progress
              progressVolumes
              notes
              updatedAt
              media {
                id
                episodes
                chapters
                title {
                  userPreferred
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{
      MediaListCollection: {
        lists: Array<{
          name: string;
          status: string;
          entries: Array<{
            id: number;
            mediaId: number;
            status: string;
            score?: number;
            progress?: number;
            progressVolumes?: number;
            notes?: string;
            updatedAt?: number;
            media: {
              id: number;
              episodes?: number;
              chapters?: number;
              title: { userPreferred: string };
            };
          }>;
        }>;
      };
    }>(gql, { userId: Number(profile.id), type }, credentials.accessToken);

    const items: LibraryItem[] = [];
    for (const list of data?.MediaListCollection?.lists || []) {
      for (const entry of list.entries || []) {
        items.push({
          id: String(entry.id),
          externalId: String(entry.mediaId),
          provider: "ANILIST",
          mediaType: type === "MANGA" ? "MANGA" : "ANIME",
          title: entry.media.title.userPreferred,
          status: (entry.status as any) || "CURRENT",
          score: entry.score,
          progress: entry.progress,
          progressVolumes: entry.progressVolumes,
          totalEpisodes: entry.media.episodes,
          totalChapters: entry.media.chapters,
          updatedAt: entry.updatedAt ? new Date(entry.updatedAt * 1000) : undefined,
          notes: entry.notes,
        });
      }
    }

    return items;
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    if (!credentials.accessToken) {
      throw new ConnectionAuthError(
        "Missing access token for AniList update",
        this.provider
      );
    }

    const mediaId = Number(payload.mediaId);
    if (Number.isNaN(mediaId) || mediaId <= 0) {
      throw new ConnectionError(
        `Invalid AniList media ID: ${payload.mediaId}`,
        this.provider
      );
    }

    let status = payload.status;
    if (status) {
      const s = status.toUpperCase();
      if (s === "WATCHING" || s === "REPEATING") {
        status = "CURRENT";
      } else if (s === "ON_HOLD" || s === "HOLD") {
        status = "PAUSED";
      } else if (s === "PLANNING" || s === "PLAN_TO_WATCH" || s === "PLAN_TO_READ") {
        status = "PLANNING";
      } else if (s === "COMPLETED") {
        status = "COMPLETED";
      } else if (s === "DROPPED") {
        status = "DROPPED";
      }
    }

    const toFuzzy = (d?: Date | string | null) => {
      if (!d) return undefined;
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return undefined;
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
      };
    };

    const variables: Record<string, unknown> = {
      mediaId,
    };

    if (status) variables.status = status;
    if (payload.progress !== undefined && payload.progress !== null) {
      variables.progress = Number(payload.progress);
    }
    if (payload.score !== undefined && payload.score !== null) {
      variables.score = Number(payload.score);
    }
    if (payload.notes !== undefined && payload.notes !== null) {
      variables.notes = String(payload.notes);
    }
    if (payload.rewatched !== undefined && payload.rewatched !== null) {
      variables.repeat = Number(payload.rewatched);
    }
    const start = toFuzzy(payload.startedAt);
    if (start) variables.startedAt = start;
    const finish = toFuzzy(payload.completedAt);
    if (finish) variables.completedAt = finish;

    const mutation = `
      mutation (
        $mediaId: Int!
        $status: MediaListStatus
        $progress: Int
        $score: Float
        $startedAt: FuzzyDateInput
        $completedAt: FuzzyDateInput
        $notes: String
        $repeat: Int
      ) {
        SaveMediaListEntry(
          mediaId: $mediaId
          status: $status
          progress: $progress
          score: $score
          startedAt: $startedAt
          completedAt: $completedAt
          notes: $notes
          repeat: $repeat
        ) {
          id
          status
        }
      }
    `;

    await this.executeGraphQL(mutation, variables, credentials.accessToken);
    return true;
  }
}
