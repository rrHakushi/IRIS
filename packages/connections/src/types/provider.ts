import type {
  ConnectionAuthType,
  ConnectionCategory,
  ConnectionCredentials,
  ConnectionProvider,
  ConnectionUserProfile,
  OAuthTokens,
} from "./auth.js";
import type { GameItem, GamingProfile } from "./gaming.js";
import type {
  LibraryItem,
  MediaSearchResult,
  MediaType,
  ScrobblePayload,
  UpdateMediaPayload,
} from "./media.js";

export interface AuthUrlResult {
  url: string;
  state: string;
  codeVerifier?: string;
}

export interface AuthUrlOptions {
  state?: string;
  redirectUri: string;
  scopes?: string[];
  codeVerifier?: string;
}

export interface SearchOptions {
  type?: MediaType;
  page?: number;
  perPage?: number;
  year?: number;
  season?: string;
}

export interface ProviderCapability {
  authType: ConnectionAuthType;
  category: ConnectionCategory;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  supportsCredentials: boolean;
  supportsSearch: boolean;
  supportsLibrarySync: boolean;
  supportsScrobble: boolean;
  supportsGamingLibrary: boolean;
}

export interface ConnectionProviderAdapter {
  readonly provider: ConnectionProvider;
  readonly category: ConnectionCategory;
  readonly authType: ConnectionAuthType;
  readonly iconUrl: string;
  readonly defaultHostUrl?: string;
  readonly capabilities: ProviderCapability;
  readonly requiredEnvVars?: readonly string[];
  readonly optionalEnvVars?: readonly string[];

  /**
   * Returns true if all required environment variables are set.
   */
  isConfigured(): boolean;

  /**
   * Returns list of missing required environment variables.
   */
  getMissingEnvVars(): string[];

  /**
   * Generates authorization URL for OAuth2 flows.
   */
  getAuthUrl(options: AuthUrlOptions): Promise<AuthUrlResult>;

  /**
   * Exchanges an authorization code for tokens.
   */
  exchangeAuthCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string,
    options?: { hostUrl?: string; [key: string]: unknown }
  ): Promise<OAuthTokens>;

  /**
   * Refreshes expired access tokens using the refresh token.
   */
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Fetches user profile from provider.
   */
  getProfile(credentials: ConnectionCredentials): Promise<ConnectionUserProfile>;

  /**
   * Validates credentials and tests connection health.
   */
  testConnection(
    credentials: ConnectionCredentials
  ): Promise<{
    ok: boolean;
    message?: string;
    profile?: ConnectionUserProfile;
    credentials?: ConnectionCredentials;
  }>;

  /**
   * Searches media across the provider using user credentials.
   */
  searchMedia?(
    query: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult[]>;

  /**
   * Fetches media details by external ID directly from provider adapter if supported.
   */
  getMediaById?(
    externalId: string,
    credentials?: ConnectionCredentials,
    options?: SearchOptions
  ): Promise<MediaSearchResult | null>;

  /**
   * Fetches the user's watchlist or library items.
   */
  getLibrary?(
    credentials: ConnectionCredentials,
    options?: { type?: MediaType }
  ): Promise<LibraryItem[]>;

  /**
   * Synchronizes playback progress or scrobbles media.
   */
  scrobble?(
    credentials: ConnectionCredentials,
    payload: ScrobblePayload
  ): Promise<boolean>;

  /**
   * Fetches owned games for gaming providers.
   */
  getGames?(credentials: ConnectionCredentials): Promise<GameItem[]>;

  /**
   * Updates media status, progress, score, etc. on the provider's platform.
   */
  updateMediaEntry?(
    credentials: ConnectionCredentials,
    payload: UpdateMediaPayload
  ): Promise<boolean>;

  /**
   * Fetches gaming profile.
   */
  getGamingProfile?(credentials: ConnectionCredentials): Promise<GamingProfile>;
}
