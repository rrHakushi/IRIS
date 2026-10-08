# Iris extra (`IrisExtra.exe`)

A lightweight, native Windows desktop application in `plugins/iris-tracker-windows` built with **C# / .NET 10 (WPF)** designed to track game playtime cumulatively, link Windows processes/executables to your IRIS game list entries, and automatically sync progress every hour.

---

## Features

- **Website Matching Design**:
  - Home page layout featuring collapsible category sections and 2:3 vertical poster cards.
  - Dark theme with Mauve surface tones and Rose accent styling matching the IRIS web interface.
  - Stacked badge overlays on each card displaying cumulative hours (`18531 Hrs`) and score (`★ 10/10`).
  - Interactive pause/resume button directly on each game card.
- **Game Edit Modal with Detections**:
  - Full modal dialog with blurred banner header, favorite toggle, and white pill save button.
  - Tabs: **General**, **Connections**, **Custom Lists**, and **Detections**.
  - **Detections Tab**: Manage tracked executables, add running processes or browse files, configure window title pattern, and permanently **Unlink Game from Tracker**.
- **Permanent Unlinking**:
  - Unlinking immediately removes games from memory and persists directly to disk, ensuring unlinked games never reappear on restart.
- **Strict 1-Hour Tracking**:
  - Accurately accumulates elapsed seconds across play sessions.
  - Automatically syncs +1 hour to your IRIS profile upon reaching 3,600 seconds.
- **Start in System Tray & Background Operation**:
  - Configurable "Start minimized in System Tray" option.
  - Runs quietly in the notification tray with customized app icon (`iris.ico`).
  - No intrusive popup notifications.
- **Secure Authentication**:
  - Quick Connect with QR code or pairing code.
  - Username/Email & Password login with MFA (TOTP, Email, Backup codes).
  - DPAPI encrypted token storage.

---

## Building and Running

### Development Run
```powershell
dotnet run --project plugins/iris-tracker-windows/IrisTracker.csproj
```

### Build Output
```powershell
dotnet build plugins/iris-tracker-windows/IrisTracker.csproj
```
The compiled executable is located in:
`plugins/iris-tracker-windows/bin/Debug/net10.0-windows/IrisExtra.exe`

### Publish Standalone Release
```powershell
dotnet publish plugins/iris-tracker-windows/IrisTracker.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o plugins/iris-tracker-windows/publish
```
The standalone binary will be generated at `plugins/iris-tracker-windows/publish/IrisExtra.exe`.
