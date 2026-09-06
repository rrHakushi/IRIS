export type ConnectionProvider =
  | "ANILIST"
  | "MAL"
  | "SIMKL"
  | "BANGUMI"
  | "STEAM"
  | "RIOT_GAMES"
  | "RADARR"
  | "SONARR"
  | "READARR"
  | "LIDARR"
  | "JELLYFIN"
  | "PLEX"
  | "DEEZER"
  | "LASTFM"
  | "CUSTOM";

export type ConnectionAuthType =
  | "OAUTH2"
  | "API_KEY"
  | "CREDENTIALS"
  | "OPENID";

export type ConnectionStatus =
  | "CONNECTED"
  | "EXPIRED"
  | "REVOKED"
  | "ERROR"
  | "DISCONNECTED";

export type ConnectionCategory =
  | "TRACKING"
  | "GAMING"
  | "MEDIA"
  | "SERVARR"
  | "MUSIC";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date | string | number | null;
  tokenType?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface ApiKeyCredentials {
  apiKey: string;
  hostUrl?: string;
  extraHeaders?: Record<string, string>;
  [key: string]: unknown;
}

export interface BasicCredentials {
  username?: string;
  password?: string;
  hostUrl?: string;
  [key: string]: unknown;
}

export type ConnectionCredentials = Partial<OAuthTokens> &
  Partial<ApiKeyCredentials> &
  Partial<BasicCredentials> & {
    [key: string]: unknown;
  };

export interface ConnectionUserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  email?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface ConnectionSettings {
  librarySync?: boolean;
  isPrivate?: boolean;
  hostUrl?: string;
  customHeaders?: Record<string, string>;
  selectedLibraries?: string[];
  [key: string]: unknown;
}
