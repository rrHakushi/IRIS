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
  OAuthTokens,
  ProviderCapability,
} from "../../types/index.js";

export interface ServarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isNetCore: boolean;
  databaseType: string;
  appName: string;
  instanceName?: string;
}

export abstract class ServarrBaseAdapter extends BaseConnectionAdapter {
  abstract readonly provider: ConnectionProvider;
  readonly category: ConnectionCategory = "SERVARR";
  readonly authType: ConnectionAuthType = "API_KEY";

  readonly capabilities: ProviderCapability = {
    authType: "API_KEY",
    category: "SERVARR",
    supportsOAuth: false,
    supportsApiKey: true,
    supportsCredentials: true,
    supportsSearch: true,
    supportsLibrarySync: true,
    supportsScrobble: false,
    supportsGamingLibrary: false,
  };

  protected getNormalizedHostUrl(credentials: ConnectionCredentials): string {
    const rawUrl = credentials.hostUrl || "http://localhost:7878";
    return rawUrl.replace(/\/+$/, "");
  }

  protected getApiKey(credentials: ConnectionCredentials): string {
    const key = credentials.apiKey || credentials.accessToken;
    if (!key) {
      throw new ConnectionAuthError(
        `Missing API Key for ${this.provider}`,
        this.provider
      );
    }
    return key;
  }

  async getAuthUrl(_options: AuthUrlOptions): Promise<AuthUrlResult> {
    throw new ConnectionError(
      `${this.provider} uses API Keys and does not support OAuth browser redirects.`,
      this.provider
    );
  }

  async exchangeAuthCode(
    _code: string,
    _redirectUri: string
  ): Promise<OAuthTokens> {
    throw new ConnectionError(
      `${this.provider} uses API Keys and does not support OAuth exchange.`,
      this.provider
    );
  }

  protected async servarrFetch<T = unknown>(
    endpoint: string,
    credentials: ConnectionCredentials,
    options: RequestInit = {}
  ): Promise<T> {
    const host = this.getNormalizedHostUrl(credentials);
    const apiKey = this.getApiKey(credentials);
    const url = `${host}/api/v3/${endpoint.replace(/^\/+/, "")}`;

    const headers: Record<string, string> = {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    return await this.fetchJson<T>(url, {
      ...options,
      headers,
    });
  }

  async getSystemStatus(
    credentials: ConnectionCredentials
  ): Promise<ServarrSystemStatus> {
    return await this.servarrFetch<ServarrSystemStatus>("system/status", credentials);
  }

  async getProfile(
    credentials: ConnectionCredentials
  ): Promise<ConnectionUserProfile> {
    const status = await this.getSystemStatus(credentials);
    const host = this.getNormalizedHostUrl(credentials);

    return {
      id: `${this.provider.toLowerCase()}_${status.version}`,
      username: status.instanceName || status.appName || this.provider,
      displayName: `${status.appName || this.provider} v${status.version}`,
      profileUrl: host,
      rawMetadata: status as unknown as Record<string, unknown>,
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
        message: (err as Error).message || `${this.provider} connection test failed`,
      };
    }
  }

  async getRootFolders(
    credentials: ConnectionCredentials
  ): Promise<Array<{ id: number; path: string; freeSpace: number }>> {
    return await this.servarrFetch("rootfolder", credentials);
  }

  async getQualityProfiles(
    credentials: ConnectionCredentials
  ): Promise<Array<{ id: number; name: string }>> {
    return await this.servarrFetch("qualityprofile", credentials);
  }

  async executeCommand(
    credentials: ConnectionCredentials,
    command: { name: string; [key: string]: unknown }
  ): Promise<unknown> {
    return await this.servarrFetch("command", credentials, {
      method: "POST",
      body: JSON.stringify(command),
    });
  }

  async getQueue(
    credentials: ConnectionCredentials,
    params: {
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDirection?: "ascending" | "descending";
      includeUnknownSeriesItems?: boolean;
      includeSeries?: boolean;
      includeEpisode?: boolean;
      includeMovie?: boolean;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.sortKey) query.set("sortKey", params.sortKey);
    if (params.sortDirection) query.set("sortDirection", params.sortDirection);
    if (params.includeUnknownSeriesItems !== undefined)
      query.set("includeUnknownSeriesItems", String(params.includeUnknownSeriesItems));
    if (params.includeSeries !== undefined)
      query.set("includeSeries", String(params.includeSeries));
    if (params.includeEpisode !== undefined)
      query.set("includeEpisode", String(params.includeEpisode));
    if (params.includeMovie !== undefined)
      query.set("includeMovie", String(params.includeMovie));

    const qs = query.toString();
    return await this.servarrFetch(`queue${qs ? `?${qs}` : ""}`, credentials);
  }

  async deleteQueueItem(
    credentials: ConnectionCredentials,
    id: number | string,
    options: { removeFromClient?: boolean; blocklist?: boolean; skipRedownload?: boolean } = {}
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (options.removeFromClient !== undefined)
      query.set("removeFromClient", String(options.removeFromClient));
    if (options.blocklist !== undefined)
      query.set("blocklist", String(options.blocklist));
    if (options.skipRedownload !== undefined)
      query.set("skipRedownload", String(options.skipRedownload));

    const qs = query.toString();
    return await this.servarrFetch(`queue/${id}${qs ? `?${qs}` : ""}`, credentials, {
      method: "DELETE",
    });
  }

  async getManualImport(
    credentials: ConnectionCredentials,
    params: {
      folder?: string;
      downloadId?: string;
      seriesId?: number;
      movieId?: number;
      filterExistingFiles?: boolean;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.folder) query.set("folder", params.folder);
    if (params.downloadId) query.set("downloadId", params.downloadId);
    if (params.seriesId) query.set("seriesId", String(params.seriesId));
    if (params.movieId) query.set("movieId", String(params.movieId));
    if (params.filterExistingFiles !== undefined)
      query.set("filterExistingFiles", String(params.filterExistingFiles));

    const qs = query.toString();
    return await this.servarrFetch(`manualimport${qs ? `?${qs}` : ""}`, credentials);
  }

  async executeManualImport(
    credentials: ConnectionCredentials,
    files: Array<Record<string, unknown>>
  ): Promise<unknown> {
    return await this.servarrFetch("manualimport", credentials, {
      method: "POST",
      body: JSON.stringify(files),
    });
  }

  async getReleases(
    credentials: ConnectionCredentials,
    params: {
      seriesId?: number;
      seasonNumber?: number;
      episodeId?: number;
      movieId?: number;
      term?: string;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.seriesId) query.set("seriesId", String(params.seriesId));
    if (params.seasonNumber !== undefined) query.set("seasonNumber", String(params.seasonNumber));
    if (params.episodeId) query.set("episodeId", String(params.episodeId));
    if (params.movieId) query.set("movieId", String(params.movieId));
    if (params.term) query.set("term", params.term);

    const qs = query.toString();
    return await this.servarrFetch(`release${qs ? `?${qs}` : ""}`, credentials);
  }

  async downloadRelease(
    credentials: ConnectionCredentials,
    payload: {
      guid?: string;
      indexerId?: number;
      title?: string;
      downloadUrl?: string;
      protocol?: string;
      publishDate?: string;
      [key: string]: unknown;
    }
  ): Promise<unknown> {
    return await this.servarrFetch("release", credentials, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getHistory(
    credentials: ConnectionCredentials,
    params: {
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDirection?: "ascending" | "descending";
      eventType?: number;
      seriesId?: number;
      movieId?: number;
      episodeId?: number;
      downloadId?: string;
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.sortKey) query.set("sortKey", params.sortKey);
    if (params.sortDirection) query.set("sortDirection", params.sortDirection);
    if (params.eventType) query.set("eventType", String(params.eventType));
    if (params.seriesId) query.set("seriesId", String(params.seriesId));
    if (params.movieId) query.set("movieId", String(params.movieId));
    if (params.episodeId) query.set("episodeId", String(params.episodeId));
    if (params.downloadId) query.set("downloadId", params.downloadId);

    const qs = query.toString();
    return await this.servarrFetch(`history${qs ? `?${qs}` : ""}`, credentials);
  }

  async getBlocklist(
    credentials: ConnectionCredentials,
    params: {
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDirection?: "ascending" | "descending";
    } = {}
  ): Promise<any> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.sortKey) query.set("sortKey", params.sortKey);
    if (params.sortDirection) query.set("sortDirection", params.sortDirection);

    const qs = query.toString();
    return await this.servarrFetch(`blocklist${qs ? `?${qs}` : ""}`, credentials);
  }

  async deleteBlocklist(
    credentials: ConnectionCredentials,
    id: number | string
  ): Promise<unknown> {
    return await this.servarrFetch(`blocklist/${id}`, credentials, {
      method: "DELETE",
    });
  }

  async deleteBlocklistBulk(
    credentials: ConnectionCredentials,
    ids: number[]
  ): Promise<unknown> {
    return await this.servarrFetch("blocklist/bulk", credentials, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  async getHealth(credentials: ConnectionCredentials): Promise<any[]> {
    return await this.servarrFetch<any[]>("health", credentials);
  }

  async getDiskSpace(credentials: ConnectionCredentials): Promise<any[]> {
    return await this.servarrFetch<any[]>("diskspace", credentials);
  }

  async getIndexers(credentials: ConnectionCredentials): Promise<any[]> {
    return await this.servarrFetch<any[]>("indexer", credentials);
  }

  async getDownloadClients(credentials: ConnectionCredentials): Promise<any[]> {
    return await this.servarrFetch<any[]>("downloadclient", credentials);
  }

  async getRenamePreview(
    credentials: ConnectionCredentials,
    params: { seriesId?: number; movieId?: number; seasonNumber?: number } = {}
  ): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.seriesId) query.set("seriesId", String(params.seriesId));
    if (params.movieId) query.set("movieId", String(params.movieId));
    if (params.seasonNumber !== undefined) query.set("seasonNumber", String(params.seasonNumber));

    const qs = query.toString();
    return await this.servarrFetch<any[]>(`rename${qs ? `?${qs}` : ""}`, credentials);
  }
}

