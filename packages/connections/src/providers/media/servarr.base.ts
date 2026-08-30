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
}
