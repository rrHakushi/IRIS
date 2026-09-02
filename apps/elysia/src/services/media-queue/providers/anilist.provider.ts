import { logQueue } from "../logger.js";
import { c } from "../../../utils/colors.js";

export interface AniListMediaRelationNode {
  id: number;
  type: "ANIME" | "MANGA";
  format?: string;
  status?: string;
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
  };
}

export interface AniListMediaRelationEdge {
  relationType: string;
  node: AniListMediaRelationNode;
}

export interface AniListAnimePayload {
  id: number;
  idMal?: number;
  updatedAt?: number;
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
  hashtag?: string;
  countryOfOrigin?: string;
  episodes?: number;
  duration?: number;
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
  genres?: string[];
  source?: string;
  format?: string;
  status?: string;
  season?: string;
  seasonYear?: number;
  averageScore?: number;
  popularity?: number;
  favourites?: number;
  isAdult?: boolean;
  synonyms?: string[];
  siteUrl?: string;
  externalLinks?: Array<{
    id: number;
    url: string;
    site: string;
    type?: string;
    icon?: string;
    color?: string;
    language?: string;
    notes?: string;
    isDisabled?: boolean;
  }>;
  trailer?: { id?: string; site?: string };
  nextAiringEpisode?: { episode: number; airingAt: number };
  streamingEpisodes?: Array<{
    title?: string;
    thumbnail?: string;
    url?: string;
    site?: string;
  }>;
  airingSchedule?: {
    nodes: Array<{ id: number; episode: number; airingAt: number }>;
  };
  studios?: {
    edges: Array<{
      isMain: boolean;
      node: { id: number; name: string; isAnimationStudio: boolean; siteUrl?: string };
    }>;
  };
  characters?: {
    edges: Array<{
      role: string;
      node: {
        id: number;
        name: { full: string; native?: string; alternative?: string[]; alternativeSpoiler?: string[] };
        image?: { large?: string; medium?: string };
        description?: string;
        gender?: string;
        age?: string;
        bloodType?: string;
        dateOfBirth?: { year?: number; month?: number; day?: number };
        favourites?: number;
      };
      voiceActors?: Array<{
        id: number;
        name: { full: string; native?: string; alternative?: string[] };
        image?: { large?: string; medium?: string };
        description?: string;
        languageV2?: string;
      }>;
    }>;
  };
  staff?: {
    edges: Array<{
      role: string;
      node: {
        id: number;
        name: { full: string; native?: string; alternative?: string[] };
        image?: { large?: string; medium?: string };
        description?: string;
        primaryOccupations?: string[];
      };
    }>;
  };
  relations?: {
    edges: AniListMediaRelationEdge[];
  };
}

export interface AniListMangaPayload {
  id: number;
  idMal?: number;
  updatedAt?: number;
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
  hashtag?: string;
  countryOfOrigin?: string;
  chapters?: number;
  volumes?: number;
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
  genres?: string[];
  source?: string;
  format?: string;
  status?: string;
  averageScore?: number;
  popularity?: number;
  favourites?: number;
  isAdult?: boolean;
  synonyms?: string[];
  siteUrl?: string;
  externalLinks?: Array<{
    id: number;
    url: string;
    site: string;
    type?: string;
    icon?: string;
    color?: string;
    language?: string;
    notes?: string;
    isDisabled?: boolean;
  }>;
  characters?: {
    edges: Array<{
      role: string;
      node: {
        id: number;
        name: { full: string; native?: string; alternative?: string[]; alternativeSpoiler?: string[] };
        image?: { large?: string; medium?: string };
        description?: string;
        gender?: string;
        age?: string;
        bloodType?: string;
        dateOfBirth?: { year?: number; month?: number; day?: number };
        favourites?: number;
      };
    }>;
  };
  staff?: {
    edges: Array<{
      role: string;
      node: {
        id: number;
        name: { full: string; native?: string; alternative?: string[] };
        image?: { large?: string; medium?: string };
        description?: string;
      };
    }>;
  };
  relations?: {
    edges: AniListMediaRelationEdge[];
  };
}

export interface AniListAnimeSearchPreview {
  id: number;
  title: {
    userPreferred?: string;
    romaji?: string;
    english?: string;
    native?: string;
  };
  coverImage?: {
    large?: string;
  };
  isAdult?: boolean;
  format?: string;
  seasonYear?: number;
  season?: string;
}

export interface AniListMangaSearchPreview {
  id: number;
  title: {
    userPreferred?: string;
    romaji?: string;
    english?: string;
    native?: string;
  };
  coverImage?: {
    large?: string;
  };
  isAdult?: boolean;
  format?: string;
  startDate?: { year?: number };
}

export class AniListProvider {
  private readonly endpoint = "https://graphql.anilist.co";
  private appToken: string | null = null;
  private tokenExpiresAt = 0;
  private rateLimitRemaining = 90;
  private rateLimitResetTimestamp = 0;
  private pauseUntil = 0;
  private lastRequestTime = 0;
  private last429LogTime = 0;
  private requestQueue: Promise<unknown> = Promise.resolve();
  private readonly minDelayMs = 700; // ~85 req/min (safely within AniList 90 req/min limit)

  private getClientId(): string {
    return process.env.ANILIST_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.ANILIST_CLIENT_SECRET || "";
  }

  /**
   * Retrieves or generates a Client Credentials application token for AniList to unlock 90 req/min rate limits.
   */
  private async getAppToken(): Promise<string | null> {
    const now = Date.now();
    if (this.appToken && this.tokenExpiresAt > now + 60000) {
      return this.appToken;
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      return null;
    }

    try {
      const res = await fetch("https://anilist.co/api/v2/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { access_token: string; expires_in: number };
        if (data.access_token) {
          this.appToken = data.access_token;
          this.tokenExpiresAt = now + (data.expires_in || 31536000) * 1000;
          return this.appToken;
        }
      }
    } catch {
      // Fallback to anonymous if client credentials fail
    }

    return null;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();

    // 1. If a global 429 pause is active, wait until it clears
    if (this.pauseUntil > now) {
      const waitMs = this.pauseUntil - now;
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    // 2. Proactive rate limit reset pause if remaining header is exhausted
    const currentNow = Date.now();
    if (this.rateLimitRemaining <= 2 && this.rateLimitResetTimestamp > 0) {
      const waitMs = Math.max(0, this.rateLimitResetTimestamp * 1000 - currentNow + 1000);
      if (waitMs > 0 && waitMs < 120000) {
        const sec = (waitMs / 1000).toFixed(1);
        const now2 = Date.now();
        if (now2 - this.last429LogTime > 4000) {
          this.last429LogTime = now2;
          logQueue(
            `${c.magenta(c.bold("[MediaQueue]"))} ${c.yellow(c.bold("⏳ [RATE LIMIT]"))} ${c.yellow(`AniList threshold reached (remaining: ${this.rateLimitRemaining}). Pausing for ${sec}s until reset...`)}`
          );
        }
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    // 3. Minimum interval pacing between consecutive requests (700ms)
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
  }

  private async executeGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    // Chain onto serialized queue to ensure strict minimum delay and prevent thundering herd
    const queuePromise = this.requestQueue.then(async () => {
      return await this.performGraphQLRequest<T>(query, variables);
    });

    // Catch errors on the chain so subsequent requests don't fail immediately
    this.requestQueue = queuePromise.catch(() => {});

    return queuePromise;
  }

  private async performGraphQLRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    await this.waitForRateLimit();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
    };

    const token = await this.getAppToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    this.lastRequestTime = Date.now();

    // Inspect dynamic rate-limit headers
    const limitHeader = res.headers.get("X-RateLimit-Limit");
    const remainingHeader = res.headers.get("X-RateLimit-Remaining");
    const resetHeader = res.headers.get("X-RateLimit-Reset");

    if (remainingHeader !== null) {
      this.rateLimitRemaining = parseInt(remainingHeader, 10);
    }
    if (resetHeader !== null) {
      this.rateLimitResetTimestamp = parseInt(resetHeader, 10);
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 60;
      this.pauseUntil = Math.max(this.pauseUntil, Date.now() + retryAfter * 1000 + 1000);

      const now = Date.now();
      if (now - this.last429LogTime > 4000) {
        this.last429LogTime = now;
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`AniList HTTP 429 Too Many Requests. Pausing AniList queue for ${retryAfter}s...`)}`
        );
      }

      await new Promise((r) => setTimeout(r, retryAfter * 1000 + 1000));
      return this.performGraphQLRequest<T>(query, variables);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const error: any = new Error(`[AniListProvider] GraphQL HTTP ${res.status}: ${errText}`);
      error.status = res.status;
      throw error;
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string; status?: number }> };
    if (json.errors && json.errors.length > 0) {
      const firstError = json.errors[0];
      const error: any = new Error(`[AniListProvider] GraphQL error: ${firstError?.message}`);
      if (firstError?.status) {
        error.status = firstError.status;
      }
      throw error;
    }

    if (!json.data) {
      throw new Error("[AniListProvider] Empty response data from AniList");
    }

    return json.data;
  }

  /**
   * Fetches comprehensive anime data from AniList including relations, characters, staff, and airing schedule.
   */
  async fetchAnime(anilistId: number): Promise<AniListAnimePayload> {
    const query = `
      query GetAnimeDetails($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          updatedAt
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
          hashtag
          countryOfOrigin
          episodes
          duration
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          source
          format
          status
          season
          seasonYear
          averageScore
          popularity
          favourites
          isAdult
          synonyms
          siteUrl
          externalLinks {
            id
            url
            site
            type
            icon
            color
            language
            notes
            isDisabled
          }
          trailer {
            id
            site
          }
          nextAiringEpisode {
            episode
            airingAt
          }
          streamingEpisodes {
            title
            thumbnail
            url
            site
          }
          airingSchedule(notYetAired: false, perPage: 100) {
            nodes {
              id
              episode
              airingAt
            }
          }
          studios {
            edges {
              isMain
              node {
                id
                name
                isAnimationStudio
                siteUrl
              }
            }
          }
          characters(page: 1, perPage: 50, sort: [ROLE, RELEVANCE]) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                  alternativeSpoiler
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                gender
                age
                bloodType
                dateOfBirth {
                  year
                  month
                  day
                }
                favourites
              }
              voiceActors {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                languageV2
              }
            }
          }
          staff(page: 1, perPage: 50) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                primaryOccupations
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                title {
                  userPreferred
                  romaji
                  english
                  native
                }
                coverImage {
                  large
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{
      Media: AniListAnimePayload & {
        characters?: { pageInfo?: { hasNextPage: boolean }; edges?: any[] };
        staff?: { pageInfo?: { hasNextPage: boolean }; edges?: any[] };
      };
    }>(query, { id: anilistId });

    const media = data.Media;

    // Paginate all remaining characters (if any)
    if (media.characters?.pageInfo?.hasNextPage) {
      media.characters.edges = await this.fetchAllCharacters(
        anilistId,
        "ANIME",
        media.characters.edges || [],
        true
      );
    }

    // Paginate all remaining staff (if any)
    if (media.staff?.pageInfo?.hasNextPage) {
      media.staff.edges = await this.fetchAllStaff(
        anilistId,
        "ANIME",
        media.staff.edges || [],
        true
      );
    }

    return media;
  }

  /**
   * Fetches comprehensive manga data from AniList including relations, characters, and staff.
   */
  async fetchManga(anilistId: number): Promise<AniListMangaPayload> {
    const query = `
      query GetMangaDetails($id: Int) {
        Media(id: $id, type: MANGA) {
          id
          idMal
          updatedAt
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
          hashtag
          countryOfOrigin
          chapters
          volumes
          startDate {
            year
            month
            day
          }
          endDate {
            year
            month
            day
          }
          genres
          source
          format
          status
          averageScore
          popularity
          favourites
          isAdult
          synonyms
          siteUrl
          externalLinks {
            id
            url
            site
            type
            icon
            color
            language
            notes
            isDisabled
          }
          characters(page: 1, perPage: 50, sort: [ROLE, RELEVANCE]) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                  alternativeSpoiler
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                gender
                age
                bloodType
                dateOfBirth {
                  year
                  month
                  day
                }
                favourites
              }
            }
          }
          staff(page: 1, perPage: 50) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                type
                format
                title {
                  userPreferred
                  romaji
                  english
                  native
                }
                coverImage {
                  large
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{
      Media: AniListMangaPayload & {
        characters?: { pageInfo?: { hasNextPage: boolean }; edges?: any[] };
        staff?: { pageInfo?: { hasNextPage: boolean }; edges?: any[] };
      };
    }>(query, { id: anilistId });

    const media = data.Media;

    // Paginate all remaining characters (if any)
    if (media.characters?.pageInfo?.hasNextPage) {
      media.characters.edges = await this.fetchAllCharacters(
        anilistId,
        "MANGA",
        media.characters.edges || [],
        true
      );
    }

    // Paginate all remaining staff (if any)
    if (media.staff?.pageInfo?.hasNextPage) {
      media.staff.edges = await this.fetchAllStaff(
        anilistId,
        "MANGA",
        media.staff.edges || [],
        true
      );
    }

    return media;
  }

  /**
   * Paginates through all characters for an anime or manga.
   */
  private async fetchAllCharacters(
    mediaId: number,
    mediaType: "ANIME" | "MANGA",
    initialEdges: any[] = [],
    hasNext = false
  ): Promise<any[]> {
    const allEdges = [...initialEdges];
    let page = 2;
    let keepGoing = hasNext;

    const query = `
      query GetMediaCharacters($id: Int, $type: MediaType, $page: Int) {
        Media(id: $id, type: $type) {
          characters(page: $page, perPage: 50, sort: [ROLE, RELEVANCE]) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                  alternativeSpoiler
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                gender
                age
                bloodType
                dateOfBirth {
                  year
                  month
                  day
                }
                favourites
              }
              voiceActors {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                languageV2
              }
            }
          }
        }
      }
    `;

    while (keepGoing && page <= 25) {
      try {
        const res = await this.executeGraphQL<{
          Media: {
            characters: {
              pageInfo: { hasNextPage: boolean };
              edges: any[];
            };
          };
        }>(query, { id: mediaId, type: mediaType, page });

        const chars = res.Media?.characters;
        if (chars?.edges && chars.edges.length > 0) {
          allEdges.push(...chars.edges);
        }
        if (!chars?.pageInfo?.hasNextPage || !chars?.edges || chars.edges.length === 0) {
          keepGoing = false;
          break;
        }
        page++;
      } catch {
        break;
      }
    }

    return allEdges;
  }

  /**
   * Paginates through all staff for an anime or manga.
   */
  private async fetchAllStaff(
    mediaId: number,
    mediaType: "ANIME" | "MANGA",
    initialEdges: any[] = [],
    hasNext = false
  ): Promise<any[]> {
    const allEdges = [...initialEdges];
    let page = 2;
    let keepGoing = hasNext;

    const query = `
      query GetMediaStaff($id: Int, $type: MediaType, $page: Int) {
        Media(id: $id, type: $type) {
          staff(page: $page, perPage: 50) {
            pageInfo {
              hasNextPage
            }
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                  medium
                }
                description(asHtml: false)
                primaryOccupations
              }
            }
          }
        }
      }
    `;

    while (keepGoing && page <= 25) {
      try {
        const res = await this.executeGraphQL<{
          Media: {
            staff: {
              pageInfo: { hasNextPage: boolean };
              edges: any[];
            };
          };
        }>(query, { id: mediaId, type: mediaType, page });

        const staff = res.Media?.staff;
        if (staff?.edges && staff.edges.length > 0) {
          allEdges.push(...staff.edges);
        }
        if (!staff?.pageInfo?.hasNextPage || !staff?.edges || staff.edges.length === 0) {
          keepGoing = false;
          break;
        }
        page++;
      } catch {
        break;
      }
    }

    return allEdges;
  }

  /**
   * Searches AniList for anime by title/query and returns minimal search preview items.
   */
  async searchAnime(query: string, limit: number = 10): Promise<AniListAnimeSearchPreview[]> {
    const clean = query.trim();
    if (!clean) return [];

    const gqlQuery = `
      query SearchAnime($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title {
              userPreferred
              romaji
              english
              native
            }
            coverImage {
              large
            }
            isAdult
            format
            seasonYear
            season
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL<{
        Page?: { media?: AniListAnimeSearchPreview[] };
      }>(gqlQuery, { search: clean, perPage: Math.min(Math.max(limit, 1), 50) });

      return data.Page?.media || [];
    } catch (err: any) {
      console.error(`[AniListProvider] searchAnime failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Searches AniList for manga by title/query and returns minimal search preview items.
   */
  async searchManga(query: string, limit: number = 10): Promise<AniListMangaSearchPreview[]> {
    const clean = query.trim();
    if (!clean) return [];

    const gqlQuery = `
      query SearchManga($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
            id
            title {
              userPreferred
              romaji
              english
              native
            }
            coverImage {
              large
            }
            isAdult
            format
            startDate {
              year
            }
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL<{
        Page?: { media?: AniListMangaSearchPreview[] };
      }>(gqlQuery, { search: clean, perPage: Math.min(Math.max(limit, 1), 50) });

      return data.Page?.media || [];
    } catch (err: any) {
      console.error(`[AniListProvider] searchManga failed: ${err.message}`);
      return [];
    }
  }
}
