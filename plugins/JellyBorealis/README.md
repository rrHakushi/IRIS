# Jellyfin Server Plugin for Borealis (JellyBorealis)

The **Jellyfin Server Plugin for Borealis (JellyBorealis)** integrates your Jellyfin media server with the IRIS Borealis media tracking platform. It provides automated scrobbling, in-player media searching/linking, list item management (status, rating, progress, notes, dates, favorite), episode tracking, and per-library scrobble threshold customization.

---

## Features

1. **Borealis Design System Modal UI**:
   - Modern Mauve and Rose themed modal adhering to IRIS design specifications (`aria-rhea` style).
   - Injected directly into the Jellyfin Web video player OSD (next to favorite/heart icon) and media detail pages.
   - Clean tabbed interface:
     - **General**: Status, score, progress (+/- stepper), favorite button, personal notes, and start/finish dates.
     - **Episodes**: Quick episode tracker grid for TV shows and Anime.
     - **Jellyfin**: Dedicated mapping panel displaying the linked Borealis media item, with manual search/unlink controls and Jellyfin season mapping (shows/anime only).
2. **Dedicated Movie Linking (No Season Overhead)**:
   - Season linking is completely suppressed on movies.
3. **Per-Library Scrobble Thresholds**:
   - Configure independent scrobble completion percentages (e.g. 85% for Anime, 90% for TV, 95% for Movies) per Jellyfin library, with a global user fallback.
4. **Elysia API Integration**:
   - Strictly communicates with modern Borealis & Carina backend endpoints (`/carina/users/me`, `/borealis/search?q=...&category=...`, `/borealis/media/{category}/{id}`, `/borealis/lists/{category}/{id}`, `/borealis/lists/{category}/{id}/increment`, `/carina/favorites/{category}/{id}`).
   - Authenticated via `x-api-key`.
5. **Embedded Assets & Zero External Icon Dependencies**:
   - Official Borealis icon bundled directly into the plugin assembly DLL (`thumb.png`).
   - Serves web assets (`/Borealis/WebInjection.js`, `/Borealis/Modal.css`, `/Borealis/Icon.png`) directly from the Jellyfin server.
6. **Automated Playback Scrobbling**:
   - Automatically scrobbles progress via `POST /borealis/lists/{category}/{id}/increment` when the library-configured playback completion threshold is reached.
   - Intelligent safeguards against duplicate episode scrobbling unless marked as `REWATCHING`.

---

## Building the Plugin

### Prerequisites
- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0) or [.NET 10.0 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)

### Build & Package for Release

To compile the release DLL, package the `.zip` archive into `releases/JellyBorealis/`, compute the MD5 checksum, and update `releases/JellyBorealis/manifest.json`:

```bash
pnpm plugin:borealis:build
# Or directly:
python3 plugins/JellyBorealis/package.py
```

This generates:
- `releases/JellyBorealis/JellyBorealis_v<version>.zip`
- `releases/JellyBorealis/manifest.json`

### CI & Automated GitHub Releases

When pushed to `main`, Drone CI automatically runs the release step. If the `github_token` secret is configured in Drone CI, it creates the GitHub release tag (`jellyborealis-v<version>`) and uploads the release asset automatically.

You can also trigger release publication manually from your local terminal:
```bash
GITHUB_TOKEN=ghp_xxx pnpm plugin:borealis:release
```

---

## Installation into Jellyfin

### Method 1: Automatic Install via Plugin Repository (Recommended)

You don't need to manually download or drag DLL files. Add the Borealis plugin repository directly to Jellyfin for one-click installation and automatic updates:

1. Open your Jellyfin Web interface as an administrator.
2. Go to **Dashboard** -> **Plugins** -> **Repositories** tab.
3. Click the **+** (Add) button.
4. Fill in the repository details:
   - **Repository Name**: `JellyBorealis`
   - **Repository URL**:
     ```text
     https://raw.githubusercontent.com/rrHakushi/IRIS/main/releases/JellyBorealis/manifest.json
     ```
5. Click **Save**.
6. Switch to the **Catalog** tab.
7. Scroll down to the **General** section, click on **JellyBorealis**, and click **Install**.
8. Restart your Jellyfin Server to activate the plugin.

---

### Method 2: Manual DLL Installation (Alternative)

1. Stop your Jellyfin Server.
2. Locate your Jellyfin `plugins/` directory:
   - **Linux**: `/var/lib/jellyfin/plugins/` or `~/.config/jellyfin/plugins/`
   - **Windows**: `%AppData%\jellyfin\plugins\` or `C:\ProgramData\Jellyfin\Server\plugins\`
   - **Docker**: `/config/plugins/`
3. Create a folder named `Borealis` inside `plugins/`.
4. Copy `Jellyfin.Plugin.Borealis.dll` into the `plugins/Borealis/` folder.
5. Restart your Jellyfin Server.

---

## Web Client Injection

To enable the in-player OSD Borealis button and interactive modal in Jellyfin Web, include the injection script in your Jellyfin web client (e.g., in Jellyfin Dashboard -> General -> Custom JavaScript code, or injected into `index.html`):

```html
<script src="/Borealis/WebInjection.js"></script>
```

---

## Configuration Guide

1. Open your Jellyfin Dashboard -> **Plugins** -> **JellyBorealis**.
2. **Borealis Server Connection**:
   - **Borealis Server URL**: Base URL of your Borealis API server (e.g. `http://localhost:4000`).
   - **Borealis API Key**: Your personal `x-api-key`.
   - **Default Scrobble Threshold**: Default completion percentage (e.g. `90%`).
3. **Library Media Type & Threshold Assignments**:
   - Map each Jellyfin Library to a Borealis media type (`anime`, `tv`, `movies`).
   - Set individual completion thresholds per library (e.g., `85%` for Anime, `92%` for TV).
4. Click **Save Configuration**.
