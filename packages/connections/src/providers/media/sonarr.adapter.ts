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

  async bulkUpdateSeries(
    credentials: ConnectionCredentials,
    payload: {
      seriesIds: number[];
      monitored?: boolean;
      qualityProfileId?: number;
      seriesType?: "standard" | "daily" | "anime";
      seasonFolder?: boolean;
      rootFolderPath?: string;
    }
  ): Promise<SonarrSeries[]> {
    return await this.servarrFetch<SonarrSeries[]>("series/editor", credentials, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async bulkDeleteSeries(
    credentials: ConnectionCredentials,
    payload: {
      seriesIds: number[];
      deleteFiles?: boolean;
      addImportListExclusion?: boolean;
    }
  ): Promise<unknown> {
    return await this.servarrFetch("series/editor", credentials, {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  }

  async getEpisodeFiles(
    credentials: ConnectionCredentials,
    seriesId: number
  ): Promise<any[]> {
    return await this.servarrFetch<any[]>(
      `episodefile?seriesId=${seriesId}`,
      credentials
    );
  }

  async deleteEpisodeFile(
    credentials: ConnectionCredentials,
    fileId: number
  ): Promise<unknown> {
    return await this.servarrFetch(`episodefile/${fileId}`, credentials, {
      method: "DELETE",
    });
  }

  async getEpisodes(
    credentials: ConnectionCredentials,
    seriesId: number
  ): Promise<any[]> {
    return await this.servarrFetch<any[]>(
      `episode?seriesId=${seriesId}`,
      credentials
    );
  }

  async getSeriesById(
    credentials: ConnectionCredentials,
    id: number
  ): Promise<SonarrSeries> {
    return await this.servarrFetch<SonarrSeries>(`series/${id}`, credentials);
  }

  async updateSeries(
    credentials: ConnectionCredentials,
    series: Partial<SonarrSeries> & { id: number }
  ): Promise<SonarrSeries> {
    return await this.servarrFetch<SonarrSeries>(`series/${series.id}`, credentials, {
      method: "PUT",
      body: JSON.stringify(series),
    });
  }

  async deleteSeries(
    credentials: ConnectionCredentials,
    id: number,
    deleteFiles: boolean = false,
    addImportListExclusion: boolean = false
  ): Promise<unknown> {
    return await this.servarrFetch(
      `series/${id}?deleteFiles=${deleteFiles}&addImportListExclusion=${addImportListExclusion}`,
      credentials,
      { method: "DELETE" }
    );
  }

  async lookupSeries(
    credentials: ConnectionCredentials,
    term: string
  ): Promise<SonarrSeries[]> {
    return await this.servarrFetch<SonarrSeries[]>(
      `series/lookup?term=${encodeURIComponent(term)}`,
      credentials
    );
  }

  async getWantedMissing(
    credentials: ConnectionCredentials,
    params: {
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDirection?: "ascending" | "descending";
      monitored?: boolean;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.sortKey) query.set("sortKey", params.sortKey);
    if (params.sortDirection) query.set("sortDirection", params.sortDirection);
    if (params.monitored !== undefined) query.set("monitored", String(params.monitored));

    const qs = query.toString();
    return await this.servarrFetch(`wanted/missing${qs ? `?${qs}` : ""}`, credentials);
  }

  async getWantedCutoff(
    credentials: ConnectionCredentials,
    params: {
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDirection?: "ascending" | "descending";
      monitored?: boolean;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.sortKey) query.set("sortKey", params.sortKey);
    if (params.sortDirection) query.set("sortDirection", params.sortDirection);
    if (params.monitored !== undefined) query.set("monitored", String(params.monitored));

    const qs = query.toString();
    return await this.servarrFetch(`wanted/cutoff${qs ? `?${qs}` : ""}`, credentials);
  }

  async updateEpisode(
    credentials: ConnectionCredentials,
    episode: { id: number; [key: string]: unknown }
  ): Promise<any> {
    return await this.servarrFetch(`episode/${episode.id}`, credentials, {
      method: "PUT",
      body: JSON.stringify(episode),
    });
  }

  async setEpisodeMonitoring(
    credentials: ConnectionCredentials,
    episodeIds: number[],
    monitored: boolean
  ): Promise<any> {
    return await this.servarrFetch("episode/monitor", credentials, {
      method: "PUT",
      body: JSON.stringify({ episodeIds, monitored }),
    });
  }
}

