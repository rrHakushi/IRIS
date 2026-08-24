# Jellyfin Server Plugin for Aquila (Runa Realm)

The **Jellyfin Server Plugin for Aquila** integrates your Jellyfin media server with the Runa Realm media tracking platform (Aquila). It provides seamless, automated episode scrobbling, in-player media searching/linking, list item management (status, rating, progress, notes), and library-to-media-type administration.

---

## Features

1. **Admin Library Media Type Assignments**:
   - Assign default Aquila Media Types (`anime`, `tv`, `movie`) per Jellyfin Library via the Jellyfin Dashboard.
2. **Playback OSD Integration (Next to Heart Icon)**:
   - Injects an **Aquila logo button** right next to the Heart (`.btnFavorite`) icon in the video player OSD bar and media detail pages.
3. **Media Link Search Modal**:
   - Query Aquila search API (`GET /:mediaType/search/:title`) from within the video player.
   - **Lightweight Card UI**: Displays item `title` and `coverImage`.
   - **`onClick` Selection**: Link and persist internal Aquila IDs to Jellyfin items.
4. **In-Player Media Management**:
   - Manage status (`WATCHING`, `COMPLETED`, `PAUSED`, `DROPPED`, `PLANNING`, `REWATCHING`).
   - Manage episode count progress with `-` and `+` controls.
   - Set 1–10 rating score and personal notes.
5. **Automated 90% Playback Scrobbling**:
   - Automatically scrobbles progress via `POST /list/increment` when 90% playback completion threshold is reached.
6. **Duplicate Episode Rewatch Safeguard**:
   - Skips scrobbling if the watched episode is `<= current progress` (unless entry is marked as `REWATCHING`).
7. **Unscored Completion Safeguard**:
   - When completing the final episode of an unscored entry (`score == 0`), updates progress to max count while maintaining `WATCHING` status until a score is provided.

---

## Building the Plugin

### Prerequisites
- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)

### Build Command

```bash
dotnet build plugins/jellyfin-aquila/Jellyfin.Plugin.Aquila.csproj -c Release
```

The compiled assembly file will be located at:
`plugins/jellyfin-aquila/bin/Release/net9.0/Jellyfin.Plugin.Aquila.dll`

---

## Installation into Jellyfin

1. Stop your Jellyfin Server.
2. Locate your Jellyfin `plugins/` folder:
   - **Linux**: `/var/lib/jellyfin/plugins/` or `~/.config/jellyfin/plugins/`
   - **Windows**: `%AppData%\jellyfin\plugins\` or `C:\ProgramData\Jellyfin\Server\plugins\`
   - **Docker**: `/config/plugins/`
3. Create a folder named `Aquila` inside `plugins/`.
4. Copy `Jellyfin.Plugin.Aquila.dll` into the `plugins/Aquila/` folder.
5. Restart your Jellyfin Server.

---

## Configuration Guide

1. Open your Jellyfin Dashboard -> **Plugins** -> **Aquila**.
2. **Library Media Type Assignments**: Map your libraries to the corresponding Aquila Media Type (`anime`, `tv`, `movie`).
3. **User API Connection**:
   - **Aquila Server URL**: Base URL of your Aquila API server (e.g. `http://localhost:3000/api`).
   - **Aquila API Key**: Your personal `x-api-key`.
   - **Playback Scrobble Threshold**: Set percentage (Default: `90%`).
4. Click **Save Configuration**.
