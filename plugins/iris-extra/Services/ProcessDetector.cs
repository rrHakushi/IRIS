using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace IrisTracker.Services;

public class RunningProcessInfo
{
    public int ProcessId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;

    public string DisplayText => !string.IsNullOrEmpty(WindowTitle)
        ? $"{Name} — \"{WindowTitle}\""
        : (!string.IsNullOrEmpty(FullPath) ? $"{Name} ({FullPath})" : Name);
}

public static class ProcessDetector
{
    private static readonly HashSet<string> BlacklistedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        // Shells
        "bash", "zsh", "fish", "sh", "dash", "csh", "tcsh",
        // System & Desktop Infrastructure
        "systemd", "dbus-broker", "dbus-broker-launch", "dbus-daemon",
        "wireplumber", "pipewire", "pipewire-pulse", "polkit", "polkitd",
        "dconf-service", "gnome-keyring-daemon", "gnome-keyring-d",
        "gvfsd", "gvfsd-fuse", "gvfs-udisks2-volume-monitor",
        "ssh-agent", "gpg-agent", "sd-pam", "(sd-pam)", "obexd",
        "at-spi-bus-launcher", "at-spi-bus-laun", "at-spi2-registryd", "at-spi2-registr",
        "xdg-desktop-portal", "xdg-desktop-portal-hyprland", "xdg-desktop-portal-gtk",
        "xdg-document-portal", "xdg-permission-store",
        // Browser & IDE helper sub-processes
        "chrome_crashpad", "chrome_crashpad_handler", "crashhelper",
        "forkserver", "language_server", "nmcli", "agent", "ananicy", "ananicy-cpp",
        "Privileged Cont", "Utility Process", "Socket Process", "RDD Process",
        "QtWebEngineProcess", "QtWebEngineProc", "Isolated Web Co",
        // Terminals & Desktop Shell
        "kitty", "alacritty", "foot", "wezterm", "gnome-terminal", "konsole", "kitten",
        "Hyprland", "hyprsunset", "hyprpaper", "hyprlock", "hypridle", "waybar", "mako", "dunst",
        // Self
        "IrisTracker", "dotnet"
    };

    public static List<RunningProcessInfo> GetRunningProcesses()
    {
        var result = new Dictionary<string, RunningProcessInfo>(StringComparer.OrdinalIgnoreCase);

        // 1. Check Hyprland active client windows (OBS-style top level apps/games)
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                var hyprPsi = new ProcessStartInfo
                {
                    FileName = "hyprctl",
                    ArgumentList = { "clients", "-j" },
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var hyprProc = Process.Start(hyprPsi);
                if (hyprProc != null)
                {
                    string json = hyprProc.StandardOutput.ReadToEnd();
                    hyprProc.WaitForExit(1000);

                    if (!string.IsNullOrWhiteSpace(json))
                    {
                        using var doc = JsonDocument.Parse(json);
                        if (doc.RootElement.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var el in doc.RootElement.EnumerateArray())
                            {
                                int pid = el.TryGetProperty("pid", out var pidProp) ? pidProp.GetInt32() : 0;
                                string cls = el.TryGetProperty("class", out var clsProp) ? clsProp.GetString() ?? "" : "";
                                string title = el.TryGetProperty("title", out var titleProp) ? titleProp.GetString() ?? "" : "";
                                string initialClass = el.TryGetProperty("initialClass", out var icProp) ? icProp.GetString() ?? "" : "";

                                if (string.IsNullOrWhiteSpace(cls) && string.IsNullOrWhiteSpace(initialClass)) continue;

                                string exeName = !string.IsNullOrEmpty(initialClass) ? initialClass : cls;

                                // If running via Wine / Proton, inspect cmdline for the true game .exe
                                if (pid > 0 && Directory.Exists($"/proc/{pid}"))
                                {
                                    string wineExe = FindWineExecutable(pid);
                                    if (!string.IsNullOrEmpty(wineExe))
                                    {
                                        exeName = wineExe;
                                    }
                                }

                                if (BlacklistedNames.Contains(exeName)) continue;

                                result[exeName] = new RunningProcessInfo
                                {
                                    ProcessId = pid,
                                    Name = exeName,
                                    WindowTitle = title
                                };
                            }
                        }
                    }
                }
            }
            catch { }
        }

        // 2. Scan /proc for user processes and games
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && Directory.Exists("/proc"))
        {
            int currentUid = GetCurrentUid();

            try
            {
                var procDirs = Directory.GetDirectories("/proc");
                foreach (var dir in procDirs)
                {
                    var baseName = Path.GetFileName(dir);
                    if (!int.TryParse(baseName, out int pid)) continue;
                    if (pid == Environment.ProcessId) continue;

                    // Filter by UID: Only current user processes
                    if (currentUid >= 0 && GetProcessUid(dir) != currentUid)
                    {
                        continue;
                    }

                    string fullPath = string.Empty;
                    try
                    {
                        var link = File.ResolveLinkTarget(Path.Combine(dir, "exe"), true);
                        if (link != null) fullPath = link.FullName;
                    }
                    catch { }

                    // Skip internal system paths
                    if (fullPath.StartsWith("/usr/lib/") || fullPath.StartsWith("/usr/libexec/"))
                    {
                        continue;
                    }

                    string name = string.Empty;
                    string commPath = Path.Combine(dir, "comm");
                    if (File.Exists(commPath))
                    {
                        try { name = File.ReadAllText(commPath).Trim(); } catch { }
                    }

                    if (string.IsNullOrEmpty(name) && !string.IsNullOrEmpty(fullPath))
                    {
                        name = Path.GetFileName(fullPath);
                    }

                    if (string.IsNullOrEmpty(name)) continue;

                    // Check for Wine/Proton game executable
                    string wineExe = FindWineExecutable(pid);
                    if (!string.IsNullOrEmpty(wineExe))
                    {
                        name = wineExe;
                    }

                    if (BlacklistedNames.Contains(name)) continue;

                    // Filter out daemon pattern (ends in 'd' and in /usr/bin) unless .exe
                    if (name.EndsWith("d", StringComparison.OrdinalIgnoreCase) && !name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && fullPath.StartsWith("/usr/"))
                    {
                        continue;
                    }

                    if (!result.ContainsKey(name))
                    {
                        result[name] = new RunningProcessInfo
                        {
                            ProcessId = pid,
                            Name = name,
                            FullPath = fullPath
                        };
                    }
                }
            }
            catch { }
        }

        // 3. Fallback for Windows or standard Process inspection
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                var processes = Process.GetProcesses();
                foreach (var p in processes)
                {
                    try
                    {
                        string pName = p.ProcessName;
                        if (string.IsNullOrEmpty(pName)) continue;
                        if (BlacklistedNames.Contains(pName)) continue;

                        string fullPath = string.Empty;
                        try { fullPath = p.MainModule?.FileName ?? string.Empty; } catch { }

                        string exeName = !pName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
                            ? $"{pName}.exe"
                            : pName;

                        if (!result.ContainsKey(exeName))
                        {
                            result[exeName] = new RunningProcessInfo
                            {
                                ProcessId = p.Id,
                                Name = exeName,
                                FullPath = fullPath
                            };
                        }
                    }
                    catch { }
                    finally { p.Dispose(); }
                }
            }
            catch { }
        }

        return result.Values.OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static bool IsProcessRunning(string targetName)
    {
        if (string.IsNullOrWhiteSpace(targetName)) return false;

        string target = targetName.Trim();
        string targetNoExt = Path.GetFileNameWithoutExtension(target);
        string targetBase = Path.GetFileName(target);

        // 1. Check Process.GetProcessesByName
        try
        {
            var matched = Process.GetProcessesByName(targetNoExt);
            if (matched.Length > 0)
            {
                foreach (var p in matched) p.Dispose();
                return true;
            }

            if (!targetBase.Equals(targetNoExt, StringComparison.OrdinalIgnoreCase))
            {
                var matchedExact = Process.GetProcessesByName(targetBase);
                if (matchedExact.Length > 0)
                {
                    foreach (var p in matchedExact) p.Dispose();
                    return true;
                }
            }
        }
        catch { }

        // 2. Linux /proc inspection (supports wine/proton, command lines, comm)
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && Directory.Exists("/proc"))
        {
            try
            {
                var procDirs = Directory.GetDirectories("/proc");
                foreach (var dir in procDirs)
                {
                    var baseDirName = Path.GetFileName(dir);
                    if (!int.TryParse(baseDirName, out int pid)) continue;

                    string commPath = Path.Combine(dir, "comm");
                    if (File.Exists(commPath))
                    {
                        try
                        {
                            string comm = File.ReadAllText(commPath).Trim();
                            if (comm.Equals(target, StringComparison.OrdinalIgnoreCase) ||
                                comm.Equals(targetNoExt, StringComparison.OrdinalIgnoreCase) ||
                                comm.Equals(targetBase, StringComparison.OrdinalIgnoreCase))
                            {
                                return true;
                            }
                        }
                        catch { }
                    }

                    // Check cmdline (especially useful for Wine/Proton, e.g. "wine ... game.exe")
                    string cmdlinePath = Path.Combine(dir, "cmdline");
                    if (File.Exists(cmdlinePath))
                    {
                        try
                        {
                            string cmdline = File.ReadAllText(cmdlinePath);
                            if (cmdline.Contains(target, StringComparison.OrdinalIgnoreCase) ||
                                (!string.IsNullOrEmpty(targetNoExt) && cmdline.Contains(targetNoExt, StringComparison.OrdinalIgnoreCase)))
                            {
                                return true;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        return false;
    }

    private static string FindWineExecutable(int pid)
    {
        try
        {
            string cmdlinePath = $"/proc/{pid}/cmdline";
            if (File.Exists(cmdlinePath))
            {
                string cmdline = File.ReadAllText(cmdlinePath);
                var tokens = cmdline.Split('\0');
                foreach (var token in tokens)
                {
                    if (token.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                    {
                        return Path.GetFileName(token);
                    }
                }
            }
        }
        catch { }
        return string.Empty;
    }

    private static int GetCurrentUid()
    {
        try
        {
            string status = File.ReadAllText("/proc/self/status");
            foreach (var line in status.Split('\n'))
            {
                if (line.StartsWith("Uid:"))
                {
                    var parts = line.Split(new[] { '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length > 1 && int.TryParse(parts[1], out int uid))
                    {
                        return uid;
                    }
                }
            }
        }
        catch { }
        return -1;
    }

    private static int GetProcessUid(string procDir)
    {
        try
        {
            string statusPath = Path.Combine(procDir, "status");
            if (File.Exists(statusPath))
            {
                using var reader = new StreamReader(statusPath);
                string? line;
                while ((line = reader.ReadLine()) != null)
                {
                    if (line.StartsWith("Uid:"))
                    {
                        var parts = line.Split(new[] { '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length > 1 && int.TryParse(parts[1], out int uid))
                        {
                            return uid;
                        }
                        break;
                    }
                }
            }
        }
        catch { }
        return -1;
    }

    public static string NormalizeExeName(string exeName)
    {
        return Path.GetFileName(exeName.Trim());
    }
}
