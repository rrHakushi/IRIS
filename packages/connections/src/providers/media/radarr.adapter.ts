import { ServarrBaseAdapter } from "./servarr.base.js";
import type {
  ConnectionCredentials,
  ConnectionProvider,
  LibraryItem,
  MediaSearchResult,
  SearchOptions,
} from "../../types/index.js";

export interface RadarrMovie {
  id?: number;
  title: string;
  originalTitle?: string;
  tmdbId?: number;
  imdbId?: string;
  year?: number;
  overview?: string;
  monitored?: boolean;
  hasFile?: boolean;
  images?: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
  rootFolderPath?: string;
  qualityProfileId?: number;
}

export class RadarrAdapter extends ServarrBaseAdapter {
  readonly provider: ConnectionProvider = "RADARR";
  readonly iconUrl = "https://cdn.simpleicons.org/radarr/FFC230";
  readonly defaultHostUrl = "http://localhost:7878";

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    _options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    if (!credentials) {
      return [];
    }

    const movies = await this.servarrFetch<RadarrMovie[]>(
      `movie/lookup?term=${encodeURIComponent(query)}`,
      credentials
    );

    return (movies || []).map((m) => {
      const poster = m.images?.find((img) => img.coverType === "poster")?.remoteUrl;
      const fanart = m.images?.find((img) => img.coverType === "fanart")?.remoteUrl;

      return {
        id: String(m.tmdbId || m.id || m.title),
        externalId: String(m.tmdbId || m.id),
        provider: "RADARR",
        mediaType: "MOVIE",
        title: {
          userPreferred: m.title,
          english: m.title,
        },
        description: m.overview,
        coverImage: {
          large: poster,
        },
        bannerImage: fanart,
        releaseYear: m.year,
      };
    });
  }

  async getLibrary(credentials: ConnectionCredentials): Promise<LibraryItem[]> {
    const movies = await this.servarrFetch<RadarrMovie[]>("movie", credentials);
    return (movies || []).map((m) => ({
      id: String(m.id || m.tmdbId),
      externalId: String(m.tmdbId || m.id),
      provider: "RADARR",
      mediaType: "MOVIE" as const,
      title: m.title,
      status: m.hasFile ? ("COMPLETED" as const) : ("PLANNING" as const),
      releaseYear: m.year,
      notes: m.overview,
    }));
  }

  async getMovies(credentials: ConnectionCredentials): Promise<RadarrMovie[]> {
    return await this.servarrFetch<RadarrMovie[]>("movie", credentials);
  }

  async addMovie(
    credentials: ConnectionCredentials,
    movie: RadarrMovie
  ): Promise<RadarrMovie> {
    return await this.servarrFetch<RadarrMovie>("movie", credentials, {
      method: "POST",
      body: JSON.stringify({
        ...movie,
        monitored: movie.monitored ?? true,
        addOptions: {
          searchForMovie: true,
        },
      }),
    });
  }
}
