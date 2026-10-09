# Jellyfin Server Plugin for Iris

The **Jellyfin Server Plugin for Iris** integrates your Jellyfin media server with the IRIS media tracking platform. It provides seamless automated scrobbling, in-player media searching/linking, list item management (status, rating, progress, notes, dates, favorite), episode tracking, and per-library scrobble threshold customization.

---

## Features

1. **Iris Design System Modal UI**:
   - Modern Mauve and Rose themed modal adhering to IRIS design specifications (`aria-rhea` style).
   - Injected directly into the Jellyfin Web video player OSD (next to favorite/heart icon) and media detail pages.
   - Clean tabbed interface:
     - **General**: Status, score, progress (+/- stepper), favorite button, personal notes, and start/finish dates.
     - **Episodes**: Quick episode tracker grid for TV shows and Anime.
     - **Jellyfin**: Dedicated mapping panel displaying the linked IRIS media item, with manual search/unlink controls and Jellyfin season mapping (shows/anime only).
2. **Dedicated Movie Linking (No Season Overhead)**:
   - Season linking is completely suppressed on movies.
3. **Per-Library Scrobble Thresholds**:
   - Configure independent scrobble completion percentages (e.g. 85% for Anime, 90% for TV, 95% for Movies) per Jellyfin library, with a global user fallback.
4. **Elysia API Integration**:
   - Strictly communicates with IRIS Elysia 2.0 backend (`/users/me`, `/search/{type}`, `/media/{type}/{id}`, `/user/{username}/lists/{type}/{id}`, `/user/{username}/lists/{type}/{id}/increment`, `/user/{username}/favorites/{id}`).
   - Authenticated via `x-api-key`.
5. **Embedded Assets & Zero External Icon Dependencies**:
   - Official IRIS icon bundled directly into the plugin assembly DLL (`thumb.png`).
   - Serves web assets (`/Iris/WebInjection.js`, `/Iris/Modal.css`, `/Iris/Icon.png`) directly from the Jellyfin server.
6. **Automated Playback Scrobbling**:
   - Automatically scrobbles progress via `POST /user/{username}/lists/{type}/{id}/increment` when the library-configured playback completion threshold is reached.
   - Intelligent safeguards against duplicate episode scrobbling unless marked as `REWATCHING`.

---

## Building the Plugin

### Prerequisites
- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)

### Build Command

```bash
dotnet build "plugins/Jellyfin-IRIS List/Jellyfin.Plugin.Iris.csproj" -c Release
```

The compiled assembly file will be located at:
`plugins/Jellyfin-IRIS List/bin/Release/net9.0/Jellyfin.Plugin.Iris.dll`

---

## Installation into Jellyfin

1. Stop your Jellyfin Server.
2. Locate your Jellyfin `plugins/` directory:
   - **Linux**: `/var/lib/jellyfin/plugins/` or `~/.config/jellyfin/plugins/`
   - **Windows**: `%AppData%\jellyfin\plugins\` or `C:\ProgramData\Jellyfin\Server\plugins\`
   - **Docker**: `/config/plugins/`
3. Create a folder named `Iris` inside `plugins/`.
4. Copy `Jellyfin.Plugin.Iris.dll` into the `plugins/Iris/` folder.
5. Restart your Jellyfin Server.

---

## Web Client Injection

To enable the in-player OSD Iris button and interactive modal in Jellyfin Web, include the injection script in your Jellyfin web client (e.g., in Jellyfin Dashboard -> General -> Custom JavaScript code, or injected into `index.html`):

```html
<script src="/Iris/WebInjection.js"></script>
```

---

## Configuration Guide

1. Open your Jellyfin Dashboard -> **Plugins** -> **Iris**.
2. **IRIS Server Connection**:
   - **IRIS Server URL**: Base URL of your IRIS API server (e.g. `http://localhost:4000`).
   - **IRIS API Key**: Your personal `x-api-key`.
   - **Default Scrobble Threshold**: Default completion percentage (e.g. `90%`).
3. **Library Media Type & Threshold Assignments**:
   - Map each Jellyfin Library to an IRIS media type (`anime`, `tv`, `movie`).
   - Set individual completion thresholds per library (e.g., `85%` for Anime, `92%` for TV).
4. Click **Save Configuration**.
