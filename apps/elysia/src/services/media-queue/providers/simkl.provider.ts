import { cache } from "../../../utils/cache.js";

export interface SimklMoviePayload {
  simklId: number;
  slug?: string;
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  title?: string;
  year?: number;
  runtime?: number;
  country?: string;
  certification?: string;
  releaseDate?: string;
  imdbRating?: number;
  imdbVotes?: number;
  simklRating?: number;
  simklVotes?: number;
  poster?: string;
  overview?: string;
  genres?: string[];
}

export interface SimklTvPayload {
  simklId: number;
  slug?: string;
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  title?: string;
  overview?: string;
  year?: number;
  runtime?: number;
  country?: string;
  certification?: string;
  firstAired?: string;
  network?: string;
  imdbRating?: number;
  imdbVotes?: number;
  simklRating?: number;
  simklVotes?: number;
  poster?: string;
  genres?: string[];
  totalEpisodes?: number;
}

export class SimklProvider {
  private getClientId(): string | undefined {
    return (
      process.env.SIMKL_CLIENT_ID ||
      process.env.SIMKL_KEY ||
      process.env.SIMKL_API_KEY
    );
  }

  /**
   * Looks up a Movie on Simkl via IMDb ID, TMDb ID, TVDB ID, or title search.
   */
  async lookupMovie(identifiers: {
    imdbId?: string;
    tmdbId?: number;
    tvdbId?: number;
    title?: string;
    year?: number;
  }): Promise<SimklMoviePayload | null> {
    const clientId = this.getClientId();
    if (!clientId) return null;

    const cacheKey = `media-simkl:movie:${identifiers.imdbId || identifiers.tmdbId || identifiers.tvdbId || identifiers.title}`;
    const cached = await cache.get<SimklMoviePayload>(cacheKey);
    if (cached) return cached;

    try {
      let simklId: number | undefined;

      // 1. Search by ID
      let searchUrl = "";
      if (identifiers.imdbId) {
        searchUrl = `https://api.simkl.com/search/id?imdb=${identifiers.imdbId}&client_id=${clientId}`;
      } else if (identifiers.tmdbId) {
        searchUrl = `https://api.simkl.com/search/id?tmdb=${identifiers.tmdbId}&client_id=${clientId}`;
      } else if (identifiers.tvdbId) {
        searchUrl = `https://api.simkl.com/search/id?tvdb=${identifiers.tvdbId}&client_id=${clientId}`;
      } else if (identifiers.title) {
        const q = encodeURIComponent(identifiers.title);
        searchUrl = `https://api.simkl.com/search/movie?q=${q}${identifiers.year ? `&year=${identifiers.year}` : ""}&client_id=${clientId}`;
      }

      if (!searchUrl) return null;

      const res = await fetch(searchUrl, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const list = (await res.json()) as any[];
        if (Array.isArray(list) && list.length > 0 && list[0]?.ids?.simkl) {
          simklId = list[0].ids.simkl;
        }
      }

      if (!simklId) return null;

      // 2. Fetch full extended metadata
      const extRes = await fetch(
        `https://api.simkl.com/movies/${simklId}?extended=full&client_id=${clientId}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!extRes.ok) return null;

      const ext = (await extRes.json()) as any;
      if (!ext) return null;

      const payload: SimklMoviePayload = {
        simklId: ext.ids?.simkl || simklId,
        slug: ext.ids?.slug,
        imdbId: ext.ids?.imdb,
        tmdbId: ext.ids?.tmdb ? parseInt(ext.ids.tmdb, 10) : undefined,
        tvdbId: ext.ids?.tvdb ? parseInt(ext.ids.tvdb, 10) : undefined,
        title: ext.title,
        year: ext.year,
        runtime: ext.runtime,
        country: ext.country,
        certification: ext.certification,
        releaseDate: ext.release_date,
        imdbRating: ext.ratings?.imdb?.rating,
        imdbVotes: ext.ratings?.imdb?.votes,
        simklRating: ext.ratings?.simkl?.rating,
        simklVotes: ext.ratings?.simkl?.votes,
        poster: ext.poster ? `https://simkl.in/posters/${ext.poster}_m.webp` : undefined,
        overview: ext.overview,
        genres: ext.genres,
      };

      // Cache for 7 days
      await cache.set(cacheKey, payload, 86400 * 7);
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Looks up a TV Show on Simkl via IMDb ID, TMDb ID, TVDB ID, or title search.
   */
  async lookupTv(identifiers: {
    imdbId?: string;
    tmdbId?: number;
    tvdbId?: number;
    title?: string;
    year?: number;
  }): Promise<SimklTvPayload | null> {
    const clientId = this.getClientId();
    if (!clientId) return null;

    const cacheKey = `media-simkl:tv:${identifiers.tvdbId || identifiers.imdbId || identifiers.tmdbId || identifiers.title}`;
    const cached = await cache.get<SimklTvPayload>(cacheKey);
    if (cached) return cached;

    try {
      let simklId: number | undefined;

      // 1. Search by ID
      let searchUrl = "";
      if (identifiers.tvdbId) {
        searchUrl = `https://api.simkl.com/search/id?tvdb=${identifiers.tvdbId}&client_id=${clientId}`;
      } else if (identifiers.imdbId) {
        searchUrl = `https://api.simkl.com/search/id?imdb=${identifiers.imdbId}&client_id=${clientId}`;
      } else if (identifiers.tmdbId) {
        searchUrl = `https://api.simkl.com/search/id?tmdb=${identifiers.tmdbId}&client_id=${clientId}`;
      } else if (identifiers.title) {
        const q = encodeURIComponent(identifiers.title);
        searchUrl = `https://api.simkl.com/search/tv?q=${q}${identifiers.year ? `&year=${identifiers.year}` : ""}&client_id=${clientId}`;
      }

      if (!searchUrl) return null;

      const res = await fetch(searchUrl, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const list = (await res.json()) as any[];
        if (Array.isArray(list) && list.length > 0 && list[0]?.ids?.simkl) {
          simklId = list[0].ids.simkl;
        }
      }

      if (!simklId) return null;

      // 2. Fetch full extended TV metadata
      const extRes = await fetch(
        `https://api.simkl.com/tv/${simklId}?extended=full&client_id=${clientId}`,
        { headers: { "Content-Type": "application/json" } }
      );

      if (!extRes.ok) return null;

      const ext = (await extRes.json()) as any;
      if (!ext) return null;

      const payload: SimklTvPayload = {
        simklId: ext.ids?.simkl || simklId,
        slug: ext.ids?.slug,
        imdbId: ext.ids?.imdb,
        tmdbId: ext.ids?.tmdb ? parseInt(ext.ids.tmdb, 10) : undefined,
        tvdbId: ext.ids?.tvdb ? parseInt(ext.ids.tvdb, 10) : undefined,
        title: ext.title,
        year: ext.year,
        runtime: ext.runtime,
        country: ext.country,
        certification: ext.certification,
        firstAired: ext.first_aired,
        network: ext.network,
        imdbRating: ext.ratings?.imdb?.rating,
        imdbVotes: ext.ratings?.imdb?.votes,
        simklRating: ext.ratings?.simkl?.rating,
        simklVotes: ext.ratings?.simkl?.votes,
        poster: ext.poster ? `https://simkl.in/posters/${ext.poster}_m.webp` : undefined,
        overview: ext.overview,
        genres: ext.genres,
        totalEpisodes: ext.total_episodes,
      };

      // Cache for 7 days
      await cache.set(cacheKey, payload, 86400 * 7);
      return payload;
    } catch {
      return null;
    }
  }
}
