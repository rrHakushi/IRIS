import type {
  ConnectionCredentials,
  ConnectionProvider,
  MediaSearchResult,
  SearchOptions,
} from "../types/index.js";
import { getConnectionAdapter } from "../registry.js";
import { decryptConnectionData, encryptConnectionData } from "../crypto/envelope.js";

export interface UserConnectionRecord {
  id: string;
  userId: string;
  provider: string;
  encryptedData: string;
  expiresAt?: Date | null;
}

export interface TokenUpdateCallback {
  (connectionId: string, encryptedData: string, expiresAt?: Date | null): Promise<void>;
}

export class SearchProxyManager {
  /**
   * Dispatches a media search query to a given provider.
   * Prioritizes the authenticated user's access token to preserve instance rate limits and quotas.
   * Transparently refreshes expired tokens and updates encrypted database records.
   *
   * @param provider - Target media provider (e.g. "ANILIST", "MAL", "SIMKL", "TRAKT", "BANGUMI")
   * @param query - Search term
   * @param userConnection - Optional active connection record from database for current user
   * @param options - Search pagination and filter options
   * @param onTokenUpdate - Optional callback to persist updated token if refreshed
   * @returns Normalized array of media search results
   */
  static async search(
    provider: ConnectionProvider,
    query: string,
    userConnection?: UserConnectionRecord | null,
    options?: SearchOptions,
    onTokenUpdate?: TokenUpdateCallback
  ): Promise<MediaSearchResult[]> {
    const adapter = getConnectionAdapter(provider);
    if (!adapter.searchMedia) {
      throw new Error(`Provider ${provider} does not support media search`);
    }

    let credentials: ConnectionCredentials | undefined = undefined;

    if (userConnection && userConnection.encryptedData) {
      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          userConnection.encryptedData,
          userConnection.userId
        );

        // Check if token is expired or close to expiry (< 5 minutes left)
        const isExpiring =
          userConnection.expiresAt &&
          new Date(userConnection.expiresAt).getTime() - Date.now() < 300000;

        if (isExpiring && credentials.refreshToken && adapter.refreshAccessToken) {
          try {
            const refreshed = await adapter.refreshAccessToken(credentials.refreshToken);
            credentials = {
              ...credentials,
              ...refreshed,
            };

            // Re-encrypt and persist
            if (onTokenUpdate) {
              const updatedEncrypted = encryptConnectionData(
                credentials,
                userConnection.userId
              );
              await onTokenUpdate(
                userConnection.id,
                updatedEncrypted,
                refreshed.expiresAt ? new Date(refreshed.expiresAt) : null
              );
            }
          } catch (refreshErr) {
            console.warn(
              `[SearchProxy] Failed to refresh expired token for ${provider}:`,
              refreshErr
            );
          }
        }
      } catch (decryptErr) {
        console.warn(
          `[SearchProxy] Failed to decrypt user token for ${provider}, falling back to instance token:`,
          decryptErr
        );
        credentials = undefined;
      }
    }

    return await adapter.searchMedia(query, credentials, options);
  }

  /**
   * Fetches media details by external ID directly from provider adapter if supported.
   */
  static async getById(
    provider: ConnectionProvider,
    externalId: string,
    userConnection?: UserConnectionRecord | null,
    options?: SearchOptions
  ): Promise<MediaSearchResult | null> {
    const adapter = getConnectionAdapter(provider) as any;
    if (!adapter.getMediaById) {
      return null;
    }

    let credentials: ConnectionCredentials | undefined = undefined;
    if (userConnection && userConnection.encryptedData) {
      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          userConnection.encryptedData,
          userConnection.userId
        );
      } catch {
        credentials = undefined;
      }
    }

    return await adapter.getMediaById(externalId, credentials, options);
  }
}
