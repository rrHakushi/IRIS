# Borealis Desktop Game Playtime Tracker (`BorealisExtra`)

A native, high-performance cross-platform desktop application built with **C# / .NET 10** and **Avalonia UI** designed to track game playtime cumulatively on **Linux**, **Windows**, and **macOS**, link system processes to your Borealis game list entries, and automatically sync progress every hour.

---

## Features

- **Cross-Platform (Linux, Windows & macOS)**:
  - Built with Avalonia UI 11, running natively on Linux (Wayland, Hyprland, X11), Windows 10/11, and macOS Apple Silicon.
  - Mauve dark theme with Rose accent matching the Borealis / IRIS web interface design specifications.
- **Authentication & Single-Account Workflow**:
  - **Quick Connect**: Scan QR code or enter an 8-character pairing code from the web or mobile app to log in instantly.
  - **Password Login & MFA**: Sign in with your username or email and password, with full support for TOTP, Email verification codes, and Backup codes.
  - **Configurable API Endpoint**: Seamlessly switch between local dev (`http://localhost:4000`) and production servers.
  - **Secure Token Storage**: Encrypted on disk using machine/user-salted AES-256 with `0600` user permissions on Linux (`~/.config/IRIS/BorealisExtra`), DPAPI on Windows, and automatic migration from legacy `IrisTracker` configurations.
- **Clean Process Detection & Multi-Executable Linking**:
  - Detects active top-level GUI applications and games via Hyprland IPC (`hyprctl clients -j`) with window titles and binary names.
  - Automatic filtering: strips out system daemons, root processes, shells, and background helper threads to display only user games and applications.
  - Wine & Proton detection: automatically extracts game `.exe` binaries from Wine/Proton processes.
  - Link multiple executables (e.g. 32-bit / 64-bit binaries, mod launchers, shipping binaries) to a single Borealis game entry.
  - **Single-Tracking Guarantee**: If multiple linked processes for a title are active simultaneously, playtime is accumulated strictly once.
  - Optional window title pattern matching.
- **Cumulative 1-Hour Time Tracking**:
  - Accurately accumulates elapsed seconds across play sessions.
  - Closing a game immediately halts counting while preserving your progress (e.g., 35m / 60m).
  - Every 60 minutes (3,600s) reached automatically increments your Borealis game list entry by **+1 hour**.
- **Real-Time UI Progress**:
  - Visual cards for each linked game featuring cover art, process badges, and live status pills (`TRACKING`, `PAUSED`, `STOPPED`).
  - Progress bar showing real-time progress toward the next +1h increment (`35m 20s / 60m (58%)`).
  - Total hours logged in Borealis.
- **Offline Sync Queue**:
  - If you hit an hour mark while offline or when the API is unreachable, increments are queued locally and automatically synced once connection is restored with thread-safe atomic batching.
- **Desktop Integration**:
  - Closing the window exits the application and stops all process tracking completely.
  - Desktop notifications (`notify-send` on Linux, Toast on Windows) when an hour is recorded.
  - Optional "Launch on system startup" toggle (XDG autostart `.desktop` on Linux, registry on Windows).

---

## Directory Structure

```
plugins/BorealisExtra/
├── BorealisExtra.csproj
├── Program.cs
├── App.axaml
├── App.axaml.cs
├── MainWindow.axaml
├── MainWindow.axaml.cs
├── package.py
├── meta.json
├── Models/
│   ├── AppSettings.cs
│   ├── BorealisModels.cs
│   └── LinkedProcessEntry.cs
├── Services/
│   ├── BorealisApiClient.cs
│   ├── DesktopIntegration.cs
│   ├── ImageHelper.cs
│   ├── ProcessDetector.cs
│   ├── ProcessTrackerService.cs
│   └── StorageService.cs
├── Styles/
│   └── Theme.axaml
└── Views/
    ├── GameEditModalWindow.axaml
    ├── GameEditModalWindow.axaml.cs
    ├── LinkGameWindow.axaml
    ├── LinkGameWindow.axaml.cs
    ├── LoginView.axaml
    ├── LoginView.axaml.cs
    ├── SettingsWindow.axaml
    ├── SettingsWindow.axaml.cs
    ├── TrackerView.axaml
    └── TrackerView.axaml.cs
```

---

## Building and Packaging

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- Python 3.9+

### Packaging All Artifacts (Windows, Linux AppImage & raw binary, macOS arm64)
Run the automated packager to compile trimmed, single-file releases directly into `releases/BorealisExtra/`:

```bash
python3 plugins/BorealisExtra/package.py
```

### GitHub CI Release Mode
```bash
python3 plugins/BorealisExtra/package.py --ci
```
