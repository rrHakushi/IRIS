# IRIS Desktop Time Tracker (`iris-extra`)

A native, high-performance cross-platform desktop application built with **C# / .NET 10** and **Avalonia UI** designed to track game playtime cumulatively on **Linux** and **Windows**, link system processes to your IRIS game list entries, and automatically sync progress every hour.

---

## Features

- **Cross-Platform (Linux & Windows)**:
  - Built with Avalonia UI 11, running natively on Linux (Wayland, Hyprland, X11) and Windows 10/11.
  - Mauve dark theme with Rose accent matching the IRIS web interface design specifications.
- **Authentication & Single-Account Workflow**:
  - **Quick Connect**: Scan QR code or enter an 8-character pairing code from the IRIS web or mobile app to log in instantly.
  - **Password Login & MFA**: Sign in with your username or email and password, with full support for TOTP, Email verification codes, and Backup codes.
  - **Configurable API Endpoint**: Seamlessly switch between local dev (`http://localhost:4000`) and production servers.
  - **Secure Token Storage**: Encrypted on disk using machine/user-salted AES-256 with `0600` user permissions on Linux (`~/.config/IRIS/IrisTracker`) and DPAPI on Windows.
- **Clean Process Detection & Multi-Executable Linking**:
  - Detects active top-level GUI applications and games via Hyprland IPC (`hyprctl clients -j`) with window titles and binary names.
  - Automatic filtering: strips out system daemons, root processes, shells, and background helper threads to display only user games and applications.
  - Wine & Proton detection: automatically extracts game `.exe` binaries from Wine/Proton processes.
  - Link multiple executables (e.g. 32-bit / 64-bit binaries, mod launchers, shipping binaries) to a single IRIS game entry.
  - **Single-Tracking Guarantee**: If multiple linked processes for a title are active simultaneously, playtime is accumulated strictly once.
  - Optional window title pattern matching.
- **Cumulative 1-Hour Time Tracking**:
  - Accurately accumulates elapsed seconds across play sessions.
  - Closing a game immediately halts counting while preserving your progress (e.g., 35m / 60m).
  - Every 60 minutes (3,600s) reached automatically increments your IRIS game list entry by **+1 hour**.
- **Real-Time UI Progress**:
  - Visual cards for each linked game featuring cover art, process badges, and live status pills (`TRACKING`, `PAUSED`, `STOPPED`).
  - Progress bar showing real-time progress toward the next +1h increment (`35m 20s / 60m (58%)`).
  - Total hours logged in IRIS.
- **Offline Sync Queue**:
  - If you hit an hour mark while offline or when the IRIS API is unreachable, increments are queued locally and automatically synced once connection is restored with thread-safe atomic batching.
- **Desktop Integration**:
  - Closing the window exits the application and stops all process tracking completely.
  - Desktop notifications (`notify-send` / freedesktop notifications on Linux, Toast on Windows) when an hour is recorded.
  - Optional "Launch on system startup" toggle (XDG autostart `.desktop` on Linux, registry on Windows).

---

## Directory Structure

```
iris-extra/
├── IrisTracker.csproj
├── Program.cs
├── App.axaml
├── App.axaml.cs
├── MainWindow.axaml
├── MainWindow.axaml.cs
├── Models/
│   ├── AppSettings.cs
│   ├── IrisModels.cs
│   └── LinkedProcessEntry.cs
├── Services/
│   ├── DesktopIntegration.cs
│   ├── ImageHelper.cs
│   ├── IrisApiClient.cs
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

## Building and Running

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)

### Development Run
From the repository root or from `iris-extra`:

```bash
# Run directly
dotnet run --project iris-extra/IrisTracker.csproj
```

### Build
```bash
dotnet build iris-extra/IrisTracker.csproj
```

### Publish Standalone Single-File Release

**For Linux (x64)**:
```bash
dotnet publish iris-extra/IrisTracker.csproj -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -o iris-extra/publish/linux
```

**For Windows (x64)**:
```bash
dotnet publish iris-extra/IrisTracker.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o iris-extra/publish/windows
```
