import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import DiscordProvider from "next-auth/providers/discord";
import { Provider } from "next-auth/providers/index";

/**
 * Configuration options for third-party OAuth identity providers.
 */
export interface OAuthProviderConfig {
  /**
   * Google OAuth client credentials.
   */
  readonly google?: {
    readonly clientId: string;
    readonly clientSecret: string;
  } | null;

  /**
   * Apple OAuth client credentials.
   */
  readonly apple?: {
    readonly clientId: string;
    readonly clientSecret: string;
  } | null;

  /**
   * Discord OAuth client credentials.
   */
  readonly discord?: {
    readonly clientId: string;
    readonly clientSecret: string;
  } | null;
}

/**
 * Dynamically builds the array of configured OAuth providers based on environment variables or explicit config.
 *
 * Supported providers:
 * - Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
 * - Apple (`APPLE_ID`, `APPLE_SECRET`)
 * - Discord (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`)
 *
 * @param config - Optional explicit OAuth credentials override.
 * @returns Array of active NextAuth OAuth provider instances.
 */
export function getOAuthProviders(config: OAuthProviderConfig | null = null): Provider[] {
  const providers: Provider[] = [];

  // 1. Google OAuth
  const googleClientId = config?.google?.clientId || process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = config?.google?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    providers.push(
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  // 2. Apple OAuth
  const appleClientId = config?.apple?.clientId || process.env.APPLE_ID;
  const appleClientSecret = config?.apple?.clientSecret || process.env.APPLE_SECRET;
  if (appleClientId && appleClientSecret) {
    providers.push(
      AppleProvider({
        clientId: appleClientId,
        clientSecret: appleClientSecret,
      }),
    );
  }

  // 3. Discord OAuth
  const discordClientId = config?.discord?.clientId || process.env.DISCORD_CLIENT_ID;
  const discordClientSecret = config?.discord?.clientSecret || process.env.DISCORD_CLIENT_SECRET;
  if (discordClientId && discordClientSecret) {
    providers.push(
      DiscordProvider({
        clientId: discordClientId,
        clientSecret: discordClientSecret,
      }),
    );
  }

  return providers;
}
