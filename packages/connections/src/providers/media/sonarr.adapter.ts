import { ServarrBaseAdapter } from "./servarr.base.js";
import type {
  ConnectionCredentials,
  ConnectionProvider,
  LibraryItem,
  MediaSearchResult,
  SearchOptions,
} from "../../types/index.js";

export interface SonarrSeries {
  id?: number;
  title: string;
  originalTitle?: string;
  tvdbId?: number;
  tvMazeId?: number;
  imdbId?: string;
  year?: number;
  overview?: string;
  monitored?: boolean;
  seasons?: Array<{ seasonNumber: number; monitored: boolean }>;
  images?: Array<{ coverType: string; remoteUrl?: string; url?: string }>;
  rootFolderPath?: string;
  qualityProfileId?: number;
  seasonFolder?: boolean;
}

export class SonarrAdapter extends ServarrBaseAdapter {
  readonly provider: ConnectionProvider = "SONARR";
  readonly iconUrl = "https://cdn.simpleicons.org/sonarr/00CDF0";
  readonly defaultHostUrl = "http://localhost:8989";

  async searchMedia(
    query: string,
    credentials?: ConnectionCredentials,
    _options?: SearchOptions
  ): Promise<MediaSearchResult[]> {
    if (!credentials) {
      return [];
    }

    const seriesList = await this.servarrFetch<SonarrSeries[]>(
      `series/lookup?term=${encodeURIComponent(query)}`,
      credentials
    );

    return (seriesList || []).map((s) => {
      const poster = s.images?.find((img) => img.coverType === "poster")?.remoteUrl;
      const fanart = s.images?.find((img) => img.coverType === "fanart")?.remoteUrl;

      return {
        id: String(s.tvdbId || s.id || s.title),
        externalId: String(s.tvdbId || s.id),
        provider: "SONARR",
        mediaType: "TV",
        title: {
          userPreferred: s.title,
          english: s.title,
        },
        description: s.overview,
        coverImage: {
          large: poster,
        },
        bannerImage: fanart,
        releaseYear: s.year,
      };
    });
  }

  async getLibrary(credentials: ConnectionCredentials): Promise<LibraryItem[]> {
    const seriesList = await this.servarrFetch<SonarrSeries[]>("series", credentials);
    return (seriesList || []).map((s) => ({
      id: String(s.id || s.tvdbId),
      externalId: String(s.tvdbId || s.id),
      provider: "SONARR",
      mediaType: "TV" as const,
      title: s.title,
      status: s.monitored ? ("CURRENT" as const) : ("COMPLETED" as const),
      releaseYear: s.year,
      notes: s.overview,
    }));
  }

  async getSeries(credentials: ConnectionCredentials): Promise<SonarrSeries[]> {
    return await this.servarrFetch<SonarrSeries[]>("series", credentials);
  }

  async addSeries(
    credentials: ConnectionCredentials,
    series: SonarrSeries
  ): Promise<SonarrSeries> {
    return await this.servarrFetch<SonarrSeries>("series", credentials, {
      method: "POST",
      body: JSON.stringify({
        ...series,
        monitored: series.monitored ?? true,
        seasonFolder: series.seasonFolder ?? true,
        addOptions: {
          searchForMissingEpisodes: true,
        },
      }),
    });
  }
}
