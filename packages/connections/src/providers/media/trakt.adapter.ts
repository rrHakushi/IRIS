import crypto from "node:crypto";
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

export class TraktAdapter extends BaseConnectionAdapter {
  readonly provider: ConnectionProvider = "TRAKT";
  readonly category: ConnectionCategory = "TRACKING";
  readonly authType: ConnectionAuthType = "OAUTH2";
  readonly iconUrl = "/icons/connections/trakt.svg";
  readonly requiredEnvVars = ["TRAKT_CLIENT_ID"] as const;
  readonly optionalEnvVars = ["TRAKT_CLIENT_SECRET"] as const;

  private static readonly BASE_URL = "https://api.trakt.tv";
  private static readonly USER_AGENT = "IRIS/1.0 (https://github.com/rrHakushi/IRIS)";

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
    return (Bun.env.TRAKT_CLIENT_ID || "").trim();
  }

  private getClientSecret(): string {
    return (Bun.env.TRAKT_CLIENT_SECRET || "").trim();
  }

  private buildHeaders(credentials?: ConnectionCredentials): Record<string, string> {
    const clientId = this.getClientId();
    const headers: Record<string, string> = {
      "User-Agent": TraktAdapter.USER_AGENT,
      "Content-Type": "application/json",
      Accept: "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
    };
    const token = credentials?.accessToken || credentials?.apiKey;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new ConnectionError("Missing TRAKT_CLIENT_ID environment variable", this.provider);
    }
    const state = options.state || Math.random().toString(36).substring(2);
    const url = new URL("https://trakt.tv/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("state", state);

    if (options.codeVerifier) {
      const challenge = crypto
        .createHash("sha256")
        .update(options.codeVerifier)
        .digest("base64url");
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
    }

    return {
      url: url.toString(),
      state,
    };
  }

  async exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const body: Record<string, unknown> = {
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };
    if (clientSecret) {
      body.client_secret = clientSecret;
    }
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
      created_at: number;
    }>(`${TraktAdapter.BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 7776000) * 1000);

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

    const body: Record<string, unknown> = {
      refresh_token: refreshToken,
      client_id: clientId,
      grant_type: "refresh_token",
    };
    if (clientSecret) {
      body.client_secret = clientSecret;
    }

    const res = await this.fetchJson<{
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
      created_at: number;
    }>(`${TraktAdapter.BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const expiresAt = new Date(Date.now() + (res.expires_in || 7776000) * 1000);

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      expiresAt,
      tokenType: res.token_type || "Bearer",
    };
  }

  async getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile> {
    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      throw new ConnectionAuthError("Missing Trakt access token", this.provider);
    }

    const data = await this.fetchJson<{
      username: string;
      name?: string;
      ids?: { slug?: string };
      about?: string;
      images?: { avatar?: { full?: string } };
    }>(`${TraktAdapter.BASE_URL}/users/me`, {
      headers: this.buildHeaders(credentials),
    });

    return {
      id: data.ids?.slug || data.username,
      username: data.username,
      displayName: data.name || data.username,
      avatarUrl: data.images?.avatar?.full,
      profileUrl: `https://trakt.tv/users/${data.ids?.slug || data.username}`,
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
        message: (err as Error).message || "Trakt connection test failed",
      };
    }
  }

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    if (options?.type === "MANGA" || options?.type === "BOOK" || options?.type === "GAME") {
      return [];
    }

    const limit = Math.min(options?.perPage || 20, 40);
    const page = options?.page || 1;
    const isMovie = options?.type === "MOVIE";
    const isTv = options?.type === "TV";

    // If type is explicitly MOVIE or TV, search that specific endpoint; otherwise search movies and shows
    const endpoints = isMovie
      ? [`/search/movie?query=${encodeURIComponent(query.trim())}&limit=${limit}&page=${page}`]
      : isTv
        ? [`/search/show?query=${encodeURIComponent(query.trim())}&limit=${limit}&page=${page}`]
        : [
            `/search/movie?query=${encodeURIComponent(query.trim())}&limit=${Math.ceil(limit / 2)}&page=${page}`,
            `/search/show?query=${encodeURIComponent(query.trim())}&limit=${Math.ceil(limit / 2)}&page=${page}`,
          ];

    const results: MediaSearchResult[] = [];

    for (const ep of endpoints) {
      try {
        const hits = await this.fetchJson<
          Array<{
            type: "movie" | "show";
            score?: number;
            movie?: {
              title: string;
              year?: number;
              ids: { trakt: number; slug: string; tmdb?: number; imdb?: string };
              overview?: string;
            };
            show?: {
              title: string;
              year?: number;
              ids: { trakt: number; slug: string; tmdb?: number; imdb?: string };
              overview?: string;
            };
          }>
        >(`${TraktAdapter.BASE_URL}${ep}`, {
          headers: this.buildHeaders(credentials),
        });

        for (const hit of hits || []) {
          const item = hit.movie || hit.show;
          if (!item) continue;
          const mediaType = hit.type === "movie" ? "MOVIE" : "TV";
          const traktId = item.ids?.trakt;
          if (!traktId) continue;

          results.push({
            id: String(traktId),
            externalId: String(traktId),
            provider: "TRAKT",
            mediaType,
            format: mediaType,
            title: {
              userPreferred: item.title,
              english: item.title,
            },
            description: item.overview,
            releaseYear: item.year,
            url: `https://trakt.tv/${hit.type === "movie" ? "movies" : "shows"}/${item.ids?.slug || traktId}`,
          });
        }
      } catch (err: any) {
        console.warn(`[Trakt] Search failed for endpoint ${ep}:`, err?.message || err);
      }
    }

    return results;
  }

  async getMediaById(
    externalId: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const isMovie = options?.type === "MOVIE";
    const endpoint = isMovie
      ? `/movies/${encodeURIComponent(externalId)}?extended=full`
      : `/shows/${encodeURIComponent(externalId)}?extended=full`;

    try {
      const item = await this.fetchJson<{
        title: string;
        year?: number;
        ids: { trakt: number; slug: string; tmdb?: number; imdb?: string };
        overview?: string;
        rating?: number;
        aired_episodes?: number;
      }>(`${TraktAdapter.BASE_URL}${endpoint}`, {
        headers: this.buildHeaders(credentials),
      });

      if (!item?.ids?.trakt) return null;

      return {
        id: String(item.ids.trakt),
        externalId: String(item.ids.trakt),
        provider: "TRAKT",
        mediaType: isMovie ? "MOVIE" : "TV",
        format: isMovie ? "MOVIE" : "TV",
        title: {
          userPreferred: item.title,
          english: item.title,
        },
        description: item.overview,
        episodes: item.aired_episodes,
        releaseYear: item.year,
        averageScore: item.rating ? Math.round(item.rating * 10) : undefined,
        url: `https://trakt.tv/${isMovie ? "movies" : "shows"}/${item.ids?.slug || item.ids?.trakt}`,
      };
    } catch {
      return null;
    }
  }

  async getLibrary(
    credentials: ConnectionCredentials,
    options?: { type?: string }
  ): Promise<LibraryItem[]> {
    const isMovie = options?.type === "MOVIE";
    const endpoint = isMovie ? "/sync/watched/movies" : "/sync/watched/shows";

    const data = await this.fetchJson<
      Array<{
        plays: number;
        last_watched_at: string;
        movie?: { title: string; year?: number; ids: { trakt: number } };
        show?: { title: string; year?: number; ids: { trakt: number }; aired_episodes?: number };
        seasons?: Array<{ number: number; episodes: Array<{ number: number; plays: number }> }>;
      }>
    >(`${TraktAdapter.BASE_URL}${endpoint}`, {
      headers: this.buildHeaders(credentials),
    });

    return (data || []).map((entry) => {
      const item = entry.movie || entry.show;
      const traktId = String(item?.ids?.trakt || Math.random());
      const totalWatchedEpisodes =
        entry.seasons?.reduce((acc, s) => acc + (s.episodes?.length || 0), 0) ?? entry.plays;

      return {
        id: traktId,
        externalId: traktId,
        provider: "TRAKT",
        mediaType: isMovie ? "MOVIE" : "TV",
        title: item?.title || `Trakt #${traktId}`,
        status: "COMPLETED",
        progress: isMovie ? entry.plays : totalWatchedEpisodes,
        totalEpisodes: entry.show?.aired_episodes,
        updatedAt: entry.last_watched_at ? new Date(entry.last_watched_at) : undefined,
      };
    });
  }

  async updateMediaEntry(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean> {
    const token = credentials.accessToken || credentials.apiKey;
    if (!token) {
      throw new ConnectionAuthError("Missing Trakt access token for entry update", this.provider);
    }

    if (payload.mediaType === "MANGA" || payload.mediaType === "BOOK" || payload.mediaType === "GAME") {
      return false;
    }

    const traktId = Number(payload.mediaId);
    if (Number.isNaN(traktId) || traktId <= 0) {
      throw new ConnectionError(`Invalid Trakt ID: ${payload.mediaId}`, this.provider);
    }

    const isMovie = payload.mediaType === "MOVIE";
    const headers = this.buildHeaders(credentials);

    // 1. Sync Watch History / Scrobble
    const statusUpper = (payload.status || "").toUpperCase();
    const isWatched =
      statusUpper === "COMPLETED" ||
      statusUpper === "WATCHING" ||
      statusUpper === "IN_PROGRESS";

    if (isWatched) {
      if (isMovie) {
        await this.fetchJson(`${TraktAdapter.BASE_URL}/sync/history`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            movies: [
              {
                ids: { trakt: traktId },
                watched_at: payload.completedAt || new Date().toISOString(),
              },
            ],
          }),
        });
      } else {
        // TV Show: mark episode watched
        const epNum = payload.episodeNumber || Number(payload.progress) || 1;
        const seasonNum = payload.seasonNumber || 1;

        await this.fetchJson(`${TraktAdapter.BASE_URL}/sync/history`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            shows: [
              {
                ids: { trakt: traktId },
                seasons: [
                  {
                    number: seasonNum,
                    episodes: [
                      {
                        number: epNum,
                        watched_at: payload.completedAt || new Date().toISOString(),
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        });
      }
    } else if (statusUpper === "PLANNED" || statusUpper === "PLANNING" || statusUpper === "WISH") {
      // Add to Watchlist
      const watchlistPayload = isMovie
        ? { movies: [{ ids: { trakt: traktId } }] }
        : { shows: [{ ids: { trakt: traktId } }] };

      await this.fetchJson(`${TraktAdapter.BASE_URL}/sync/watchlist`, {
        method: "POST",
        headers,
        body: JSON.stringify(watchlistPayload),
      });
    }

    // 2. Sync Rating (if score provided)
    if (payload.score !== undefined && payload.score !== null && Number(payload.score) > 0) {
      const rawScore = Number(payload.score);
      const rating = Math.min(10, Math.max(1, Math.round(rawScore > 10 ? rawScore / 10 : rawScore)));

      const ratingsPayload = isMovie
        ? { movies: [{ rating, ids: { trakt: traktId } }] }
        : { shows: [{ rating, ids: { trakt: traktId } }] };

      await this.fetchJson(`${TraktAdapter.BASE_URL}/sync/ratings`, {
        method: "POST",
        headers,
        body: JSON.stringify(ratingsPayload),
      });
    }

    return true;
  }
}
