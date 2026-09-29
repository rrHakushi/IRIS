# IRIS Windows Time Tracker (`IrisTracker.exe`)

A lightweight, native Windows desktop application in `plugins/iris-tracker-windows` built with **C# / .NET 10 (WPF)** designed to track game playtime cumulatively, link Windows processes/executables to your IRIS game list entries, and automatically sync progress every hour.

---

## Features

- **Full Authentication**:
  - **Quick Connect**: Scan QR code or enter an 8-character pairing code from the IRIS web or mobile app to log in without typing your password.
  - **Password Login**: Sign in with your username or email and password.
  - **Configurable API Endpoint**: Seamlessly switch between local dev (`http://localhost:3000`) and production servers.
  - **Secure Token Storage**: Encrypted on disk using Windows Data Protection API (DPAPI).
- **OBS-Style Process & Window Detection**:
  - Automatically scans running Windows processes and top-level application windows.
  - Matching priority: Matches by window title pattern first; if not found (e.g. title changes during loading screens), falls back to matching any window or process of the same executable (e.g. `portal2.exe`).
- **Cumulative 1-Hour Time Tracking**:
  - Accurately accumulates elapsed seconds across play sessions.
  - Closing a game immediately halts counting while preserving your progress (e.g., 35m / 60m).
  - Every 60 minutes (3,600s) reached automatically increments your IRIS game list entry by **+1 hour**.
- **Real-Time UI Progress**:
  - Visual cards for each linked game featuring cover art, process badges, and live status pills (`TRACKING` vs `STOPPED`).
  - Progress bar showing real-time progress toward the next +1h increment (`35m 20s / 60m (58%)`).
  - Total hours logged in IRIS.
- **Offline Sync Queue**:
  - If you hit an hour mark while offline or when the IRIS API is unreachable, increments are queued locally and automatically synced once connection is restored.
- **System Tray & Windows Background Operation**:
  - Minimizing or closing the window parks the app quietly in the Windows notification tray.
  - Context menu to restore, force-sync, or exit.
  - Optional Windows toast notifications when an hour is recorded.
  - Optional "Launch on Windows startup" toggle in Settings.

---

## Directory Structure

```
plugins/iris-tracker-windows/
├── IrisTracker.csproj
├── App.xaml
├── App.xaml.cs
├── MainWindow.xaml
├── MainWindow.xaml.cs
├── Models/
│   ├── AppSettings.cs
│   ├── IrisModels.cs
│   └── LinkedProcessEntry.cs
├── Services/
│   ├── IrisApiClient.cs
│   ├── ProcessTrackerService.cs
│   ├── StorageService.cs
│   └── WindowCaptureHelper.cs
├── Styles/
│   └── Theme.xaml
└── Views/
    ├── LinkGameWindow.xaml
    ├── LinkGameWindow.xaml.cs
    ├── LoginControl.xaml
    ├── LoginControl.xaml.cs
    ├── SettingsWindow.xaml
    ├── SettingsWindow.xaml.cs
    ├── TrackerControl.xaml
    └── TrackerControl.xaml.cs
```

---

## Building and Running

### Development Run
From the repository root or from `plugins/iris-tracker-windows`:

```powershell
# Run directly
dotnet run --project plugins/iris-tracker-windows/IrisTracker.csproj
```

### Build Output
```powershell
dotnet build plugins/iris-tracker-windows/IrisTracker.csproj
```
The compiled executable will be located in:
`plugins/iris-tracker-windows/bin/Debug/net10.0-windows/IrisTracker.exe`

### Publish Single-File Release
To generate a standalone `.exe` that does not require any external DLLs:
```powershell
dotnet publish plugins/iris-tracker-windows/IrisTracker.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o plugins/iris-tracker-windows/publish
```
The output `plugins/iris-tracker-windows/publish/IrisTracker.exe` can be copied and run anywhere on Windows.
