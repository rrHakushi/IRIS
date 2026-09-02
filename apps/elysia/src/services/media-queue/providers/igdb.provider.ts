import { logQueue } from "../logger.js";
import { c } from "../../../utils/colors.js";

export interface IgdbSearchPreview {
  id: number;
  name: string;
  cover?: { id: number; image_id: string };
  first_release_date?: number;
}

export interface IgdbGamePayload {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  cover?: { id: number; image_id: string };
  screenshots?: Array<{ id: number; image_id: string }>;
  artworks?: Array<{ id: number; image_id: string }>;
  first_release_date?: number; // Unix epoch in seconds
  release_dates?: Array<{
    id: number;
    date?: number;
    human?: string;
    platform?: { id: number; name: string; abbreviation?: string };
    region?: number;
  }>;
  genres?: Array<{ id: number; name: string }>;
  themes?: Array<{ id: number; name: string }>;
  keywords?: Array<{ id: number; name: string }>;
  platforms?: Array<{ id: number; name: string; abbreviation?: string }>;
  involved_companies?: Array<{
    id: number;
    developer: boolean;
    publisher: boolean;
    porting?: boolean;
    supporting?: boolean;
    company: { id: number; name: string };
  }>;
  game_modes?: Array<{ id: number; name: string }>;
  player_perspectives?: Array<{ id: number; name: string }>;
  category?: number;
  franchise?: { id: number; name: string };
  franchises?: Array<{ id: number; name: string }>;
  collection?: { id: number; name: string };
  rating?: number; // User rating 0-100
  rating_count?: number;
  aggregated_rating?: number; // Critic rating 0-100
  aggregated_rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  age_ratings?: Array<{
    id: number;
    organization?: number; // 1 = ESRB, 2 = PEGI
    rating_category?: number;
    synopsis?: string;
    rating?: number;
    category?: number;
    rating_content_descriptions?: Array<{ id: number; description: string }>;
  }>;
  status?: number;
  websites?: Array<{ id: number; category: number; url: string }>;
  videos?: Array<{ id: number; video_id: string; name?: string }>;
  external_games?: Array<{
    id: number;
    category: number;
    uid: string;
    url?: string;
  }>;
  alternative_names?: Array<{
    id: number;
    name: string;
    comment?: string;
  }>;
  game_engines?: Array<{ id: number; name: string }>;
  language_supports?: Array<{
    id: number;
    language?: { id: number; name: string };
    language_support_type?: { id: number; name: string };
  }>;
  updated_at?: number;
}

export class IGDBProvider {
  private readonly baseUrl = "https://api.igdb.com/v4";
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private lastRequestTime = 0;
  private readonly minDelayMs = 250; // 4 req/s

  private getClientId(): string {
    return process.env.IGDB_CLIENT_ID || "";
  }

  private getClientSecret(): string {
    return process.env.IGDB_CLIENT_SECRET || "";
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async getValidToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    if (!clientId || !clientSecret) {
      throw new Error("[IGDBProvider] IGDB_CLIENT_ID or IGDB_CLIENT_SECRET is missing in .env");
    }

    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const res = await fetch(tokenUrl, { method: "POST" });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[IGDBProvider] Twitch OAuth token failed HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiresAt = now + (json.expires_in - 300) * 1000;
    return this.accessToken;
  }

  /**
   * Fetches game details by IGDB Game ID.
   */
  async fetchGame(igdbId: number): Promise<IgdbGamePayload> {
    await this.waitForRateLimit();
    const token = await this.getValidToken();
    const clientId = this.getClientId();

    const query = `
      fields 
        name, slug, summary, storyline,
        cover.image_id, screenshots.image_id, artworks.image_id,
        first_release_date,
        release_dates.date, release_dates.human, release_dates.platform.name, release_dates.platform.abbreviation, release_dates.region,
        genres.name,
        platforms.name,
        platforms.abbreviation,
        themes.name,
        keywords.name,
        game_modes.name,
        player_perspectives.name,
        category,
        franchise.name, franchises.name, collection.name,
        involved_companies.developer, involved_companies.publisher, involved_companies.porting, involved_companies.supporting, involved_companies.company.name,
        rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count,
        status,
        websites.url, websites.category,
        videos.video_id, videos.name,
        external_games.category, external_games.uid, external_games.url,
        age_ratings.rating, age_ratings.category, age_ratings.content_descriptions.description,
        alternative_names.name, alternative_names.comment,
        game_engines.name,
        language_supports.language.name, language_supports.language_support_type.name;
      where id = ${igdbId};
    `;

    const res = await fetch(`${this.baseUrl}/games`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: query,
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 5;
      logQueue(
        `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`IGDB HTTP 429 Too Many Requests. Backing off for ${retryAfter}s...`)}`
      );
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.fetchGame(igdbId);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[IGDBProvider] Games query HTTP ${res.status}: ${errText}`);
    }

    const items = (await res.json()) as IgdbGamePayload[];
    if (!items || items.length === 0) {
      throw new Error(`[IGDBProvider] No game found for IGDB ID ${igdbId}`);
    }

    const game = items[0]!;

    // If age_ratings has IDs but missing rating details, expand them
    if (game.age_ratings && game.age_ratings.length > 0 && game.age_ratings[0]?.rating === undefined) {
      const ids = game.age_ratings.map((a) => a.id).filter(Boolean);
      if (ids.length > 0) {
        try {
          game.age_ratings = await this.fetchAgeRatings(ids);
        } catch {}
      }
    }

    return game;
  }

  /**
   * Fetches full age rating details by IDs.
   */
  async fetchAgeRatings(
    ids: number[]
  ): Promise<
    Array<{
      id: number;
      organization?: number;
      rating_category?: number;
      synopsis?: string;
      rating_content_descriptions?: Array<{ id: number; description: string }>;
    }>
  > {
    if (!ids || ids.length === 0) return [];
    await this.waitForRateLimit();
    const token = await this.getValidToken();
    const clientId = this.getClientId();

    const query = `
      fields organization, rating_category, synopsis, rating_content_descriptions.description;
      where id = (${ids.join(",")});
    `;

    const res = await fetch(`${this.baseUrl}/age_ratings`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: query,
    });

    if (!res.ok) return [];
    return (await res.json()) as any[];
  }

  /**
   * Searches IGDB for games by title/query and returns matching search preview items.
   */
  async searchGames(query: string, limit: number = 10): Promise<IgdbSearchPreview[]> {
    const clean = query.trim();
    if (!clean) return [];

    try {
      await this.waitForRateLimit();
      const token = await this.getValidToken();
      const clientId = this.getClientId();

      const maxResults = Math.min(Math.max(limit, 1), 50);
      const sanitized = clean.replace(/"/g, '\\"');
      const igdbQuery = `
        search "${sanitized}";
        fields id, name, cover.image_id, first_release_date;
        limit ${maxResults};
      `;

      const res = await fetch(`${this.baseUrl}/games`, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
          Accept: "application/json",
        },
        body: igdbQuery,
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 5;
        logQueue(
          `${c.magenta(c.bold("[MediaQueue]"))} ${c.red(c.bold("⚠️ [RATE LIMIT 429]"))} ${c.red(`IGDB HTTP 429 during search. Backing off for ${retryAfter}s...`)}`
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return this.searchGames(query, limit);
      }

      if (!res.ok) {
        return [];
      }

      const items = (await res.json()) as IgdbSearchPreview[];
      if (!Array.isArray(items)) return [];

      return items.filter((g) => Boolean(g && typeof g.id === "number"));
    } catch (err: any) {
      console.error(`[IGDBProvider] searchGames failed: ${err.message}`);
      return [];
    }
  }
}
