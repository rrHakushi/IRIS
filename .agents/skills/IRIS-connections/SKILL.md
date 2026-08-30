---
name: IRIS-connections
description: Guide for third-party integrations, OAuth, API key management, token encryption, media scrobbling, and search quota proxying in IRIS via @IRIS/connections.
---

# @IRIS/connections Guide

`@IRIS/connections` is the unified third-party connection and integration layer for the IRIS ecosystem. It manages OAuth2 and credential authentication, AES-256-GCM envelope encryption for stored tokens, automated progress scrobbling, watchlist synchronization, gaming library activity, and search quota offloading across tracking providers, gaming platforms, and media servers.

---

## 1. Core Architecture & Features

- **Standardized Provider Adapters**: All integrations (AniList, MAL, Simkl, Trakt, Bangumi, Steam, Epic, Riot, GOG, Spotify, Radarr, Sonarr) implement a uniform `ConnectionProviderAdapter` interface.
- **User-Key Envelope Encryption**: Tokens and credentials are encrypted using per-user AES-256-GCM keys derived via HKDF-SHA256 from the user's master salt. Plaintext credentials never touch the database.
- **Search Quota Offloading**: Media searches automatically prioritize the requesting user's connected access token, conserving server-wide API quotas.
- **Automatic Token Lifecycle**: Seamlessly refreshes expired OAuth2 access tokens on the fly and updates encrypted database records transparently.
- **Environment Auto-Disabling**: Gracefully logs missing server environment variables on startup and marks providers as disabled without application crashes.

---

## 2. Environment Variables Configuration

| Variable | Description | Required Provider |
| :--- | :--- | :--- |
| `CONNECTIONS_SECRET` | Master secret for user key derivation (falls back to `NEXTAUTH_SECRET`) | All |
| `ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` | AniList OAuth credentials | AniList |
| `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` | MyAnimeList OAuth credentials | MyAnimeList |
| `SIMKL_CLIENT_ID`, `SIMKL_CLIENT_SECRET` | Simkl OAuth credentials | Simkl |
| `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET` | Trakt.tv OAuth credentials | Trakt.tv |
| `BANGUMI_CLIENT_ID`, `BANGUMI_CLIENT_SECRET` | Bangumi OAuth credentials (optional) | Bangumi |
| `STEAM_API_KEY` | Steam Web API Key | Steam |
| `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET` | Epic Games / EOS credentials | Epic Games |
| `RIOT_CLIENT_ID`, `RIOT_CLIENT_SECRET`, `RIOT_API_KEY` | Riot Games Developer Portal | Riot Games |
| `GOG_CLIENT_ID`, `GOG_CLIENT_SECRET` | GOG Galaxy OAuth credentials | GOG.com |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify Developer credentials | Spotify |

---

## 3. Cryptographic Envelope Usage

Use `@IRIS/connections` cryptographic helpers to encrypt and decrypt sensitive connection data:

```typescript
import {
  encryptConnectionData,
  decryptConnectionData,
  deriveUserConnectionKey,
} from "@IRIS/connections";

// Encrypt credentials before writing to Prisma Connection model
const encryptedData = encryptConnectionData(tokens, userId);

// Decrypt credentials when needed for API calls
const tokens = decryptConnectionData<OAuthTokens>(
  connection.encryptedData,
  userId
);
```

---

## 4. Provider Registry Usage

Retrieve provider adapters dynamically via the registry:

```typescript
import {
  getConnectionAdapter,
  getSupportedProviders,
  validateConnectionEnvironment,
} from "@IRIS/connections";

// Check environment variable status on startup
const { configured, disabled } = validateConnectionEnvironment();

// Retrieve adapter for a specific provider
const malAdapter = getConnectionAdapter("MAL");

// Generate OAuth authorization URL with PKCE
const authResult = await malAdapter.getAuthUrl({
  state: "secure_random_state",
  redirectUri: "http://localhost:4000/connections/mal/callback",
});

// Test connection health
const healthResult = await malAdapter.testConnection(credentials);
if (healthResult.ok) {
  console.log(`Connected user: ${healthResult.profile?.displayName}`);
}
```

---

## 5. Media Search Proxy with Quota Offloading

Perform media search offloading requests to active user tokens:

```typescript
import { SearchProxyManager } from "@IRIS/connections";

const results = await SearchProxyManager.search(
  "MAL",
  "Sousou no Frieren",
  userConnectionRecord,
  { type: "ANIME", page: 1, perPage: 20 },
  async (connectionId, updatedEncryptedData, newExpiresAt) => {
    // Callback to persist refreshed tokens in DB
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        encryptedData: updatedEncryptedData,
        expiresAt: newExpiresAt,
      },
    });
  }
);
```

---

## 6. Elysia API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/connections` | `GET` | Lists all active connections for current authenticated user |
| `/connections` | `POST` | Connects via API key / credentials (Radarr, Sonarr, Bangumi PAT, etc.) |
| `/connections/providers` | `GET` | Lists all supported providers, metadata, capabilities, and configuration status |
| `/connections/:provider/auth` | `GET` | Starts OAuth flow and returns authorization URL |
| `/connections/:provider/callback` | `GET` | Handles OAuth redirect and token persistence |
| `/connections/:id` | `DELETE` | Removes and revokes user connection |
| `/connections/:id` | `PATCH` | Updates connection settings (autoSync, scrobble, isPrivate) |
| `/connections/:id/test` | `POST` | Performs live connection health check |
| `/connections/:id/sync` | `POST` | Triggers immediate library sync |
| `/connections/search` | `GET` | Searches media using delegated user tokens |
