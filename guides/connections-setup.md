# Developer Guide: Third-Party Connections Setup & OAuth Configuration

This guide provides step-by-step instructions for developers and server administrators on how to register developer applications, obtain OAuth credentials / API keys, and configure redirect URLs for all supported third-party providers in **IRIS** (`@IRIS/connections`).

---

## Quick Reference Table

| Provider | Developer Portal | Redirect URI / Callback URL | Required `.env` Variables |
| :--- | :--- | :--- | :--- |
| **AniList** | [AniList Developer Settings](https://anilist.co/settings/developer) | `http://localhost:4000/connections/anilist/callback` | `ANILIST_CLIENT_ID`<br>`ANILIST_CLIENT_SECRET` |
| **MyAnimeList** | [MAL API Config](https://myanimelist.net/apiconfig) | `http://localhost:4000/connections/mal/callback` | `MAL_CLIENT_ID`<br>`MAL_CLIENT_SECRET` *(optional with PKCE)* |
| **Simkl** | [Simkl Developer Applications](https://simkl.com/settings/developer/) | `http://localhost:4000/connections/simkl/callback` | `SIMKL_CLIENT_ID`<br>`SIMKL_CLIENT_SECRET` |
| **Bangumi** | [Bangumi Developer Applications](https://bgm.tv/dev/app) | `http://localhost:4000/connections/bangumi/callback` | `BANGUMI_CLIENT_ID`<br>`BANGUMI_CLIENT_SECRET` |
| **Steam** | [Steam Web API Key](https://steamcommunity.com/dev/apikey) | *(Uses OpenID 2.0)* | `STEAM_API_KEY` |
| **Riot Games** | [Riot Developer Portal](https://developer.riotgames.com/) | `http://localhost:4000/connections/riot_games/callback` | `RIOT_CLIENT_ID`<br>`RIOT_CLIENT_SECRET`<br>`RIOT_API_KEY` *(optional)* |
| **Radarr** | *Self-Hosted* | *N/A (Managed per-user in UI)* | *None* |
| **Sonarr** | *Self-Hosted* | *N/A (Managed per-user in UI)* | *None* |

> **Production Note**: Replace `http://localhost:4000` with your production API URL (e.g. `https://api.iris.yourdomain.com`).

---

## 1. Master Encryption Key

Credentials, API keys, and OAuth refresh tokens are encrypted at rest using AES-256-GCM envelope keys derived per user.

Add a secure 32-byte secret in your root `.env`:

```bash
# Used to derive per-user encryption keys (falls back to NEXTAUTH_SECRET if omitted)
CONNECTIONS_SECRET="replace-with-a-secure-random-64-character-hex-string"
```

---

## 2. Tracking Integrations

### AniList
1. Log in to [AniList](https://anilist.co) and navigate to **Settings** > [Developer](https://anilist.co/settings/developer).
2. Click **Create New Client**.
3. Fill in the application details:
   - **Name**: `IRIS` (or your app name)
   - **Redirect URL**: `http://localhost:4000/connections/anilist/callback`
4. Click **Save**.
5. Copy the generated **Client ID** and **Client Secret** into your `.env`:
   ```bash
   ANILIST_CLIENT_ID="your_anilist_client_id"
   ANILIST_CLIENT_SECRET="your_anilist_client_secret"
   ```

---

### MyAnimeList (MAL)
1. Log in to [MyAnimeList](https://myanimelist.net) and go to [API Config](https://myanimelist.net/apiconfig).
2. Click **Create ID**.
3. Fill in the form:
   - **App Name**: `IRIS`
   - **App Type**: `Web`
   - **App Redirect URL**: `http://localhost:4000/connections/mal/callback`
   - **Commercial / Non-Commercial**: `Non-Commercial`
4. Click **Submit**.
5. Copy the **Client ID** (and Secret if generated) into your `.env`:
   ```bash
   MAL_CLIENT_ID="your_mal_client_id"
   MAL_CLIENT_SECRET="your_mal_client_secret" # Optional when PKCE is used
   ```

---

### Simkl
1. Log in to [Simkl](https://simkl.com) and visit [Simkl Developer](https://simkl.com/settings/developer/).
2. Click **Create New App**.
3. Enter the details:
   - **Name**: `IRIS`
   - **Redirect URI**: `http://localhost:4000/connections/simkl/callback`
4. Click **Save Changes**.
5. Copy your **Client ID** and **Client Secret** into your `.env`:
   ```bash
   SIMKL_CLIENT_ID="your_simkl_client_id"
   SIMKL_CLIENT_SECRET="your_simkl_client_secret"
   ```

---

### Bangumi (番组计划)
1. Log in to [Bangumi](https://bgm.tv) and navigate to [Developer Apps](https://bgm.tv/dev/app).
2. Click **Create Application**.
3. Enter:
   - **App Name**: `IRIS`
   - **Callback URL**: `http://localhost:4000/connections/bangumi/callback`
4. Copy the **App ID** (Client ID) and **App Secret** into your `.env`:
   ```bash
   BANGUMI_CLIENT_ID="your_bangumi_app_id"
   BANGUMI_CLIENT_SECRET="your_bangumi_app_secret"
   ```
*(Note: Users can also link via personal access tokens directly in the UI)*.

---

## 3. Gaming Integrations

### Steam
Steam authentication uses OpenID 2.0 for sign-in and the Steam Web API for library and achievement sync.
1. Log in to Steam and navigate to [Steam Web API Key](https://steamcommunity.com/dev/apikey).
2. Enter your domain name (e.g. `localhost` or `iris.yourdomain.com`).
3. Click **Register**.
4. Add the key to your `.env`:
   ```bash
   STEAM_API_KEY="your_32_character_steam_web_api_key"
   ```

---

### Riot Games
1. Log in to the [Riot Developer Portal](https://developer.riotgames.com/).
2. For development or personal testing, generate a **Personal API Key** (valid 24h) or apply for a **Production API Key** / **Riot Sign-On (RSO)** client.
3. If using RSO, set the Redirect URI:
   - **Redirect URI**: `http://localhost:4000/connections/riot_games/callback`
4. Add your credentials into `.env`:
   ```bash
   RIOT_CLIENT_ID="your_riot_rso_client_id"
   RIOT_CLIENT_SECRET="your_riot_rso_client_secret"
   # Optional fallback for direct API access
   RIOT_API_KEY="RGAPI-your-api-key"
   ```

---

## 4. Self-Hosted & Media Automation

### Radarr & Sonarr
Radarr and Sonarr instances are self-hosted per-user. **No global server `.env` variables are required.**

Users connect directly from the IRIS Web UI (`Settings > Connections > Radarr/Sonarr`):
- **Server Host URL**: `http://localhost:7878` (Radarr) or `http://localhost:8989` (Sonarr)
- **API Key**: Found in Radarr/Sonarr under `Settings > General > Security > API Key`

---

## 5. Startup Guardrails & Verification

When IRIS starts up (`pnpm run dev`), the `@IRIS/connections` registry automatically scans your `.env`:
- **Configured Providers**: Activated and made available in the frontend UI.
- **Missing Env Providers**: Safely disabled on startup with a clear console warning (e.g. `[Connections] [DISABLED] Provider MAL is disabled — missing required env: MAL_CLIENT_ID`).
- **Client Sanitization**: Disabled providers are completely hidden from client API responses and will not cause runtime errors.
