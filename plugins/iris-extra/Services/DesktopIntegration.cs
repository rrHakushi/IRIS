using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace IrisTracker.Services;

public static class DesktopIntegration
{
    private const string AutostartDesktopFile = "iris-extra.desktop";

    public static void EnsureLinuxDesktopIntegration()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;

        try
        {
            string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string iconsDir = Path.Combine(home, ".local", "share", "icons");
            string hicolorDir = Path.Combine(home, ".local", "share", "icons", "hicolor", "512x512", "apps");
            string appsDir = Path.Combine(home, ".local", "share", "applications");

            Directory.CreateDirectory(iconsDir);
            Directory.CreateDirectory(hicolorDir);
            Directory.CreateDirectory(appsDir);

            string iconPath1 = Path.Combine(iconsDir, "iris-extra.png");
            string iconPath2 = Path.Combine(hicolorDir, "iris-extra.png");

            if (!File.Exists(iconPath1) || !File.Exists(iconPath2))
            {
                using var stream = Avalonia.Platform.AssetLoader.Open(new Uri("avares://IrisExtra/Assets/iris.png"));
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                var bytes = ms.ToArray();
                File.WriteAllBytes(iconPath1, bytes);
                File.WriteAllBytes(iconPath2, bytes);
            }

            string desktopEntry = Path.Combine(appsDir, "iris-extra.desktop");
            string? exePath = Environment.ProcessPath;
            if (!string.IsNullOrEmpty(exePath))
            {
                string content = $@"[Desktop Entry]
Type=Application
Version=1.0
Name=IRIS Extra
GenericName=Game Playtime Tracker
Comment=Automatic game playtime tracker for IRIS
Exec={exePath}
Icon=iris-extra
Terminal=false
Categories=Game;Utility;
Keywords=iris;extra;tracker;playtime;game;
StartupWMClass=IrisExtra
";
                File.WriteAllText(desktopEntry, content);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DesktopIntegration] Failed to ensure desktop integration: {ex.Message}");
        }
    }

    public static void ShowNotification(string title, string message)
    {
        try
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Linux: Use notify-send with custom icon or fallback
                string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string iconPath = Path.Combine(home, ".local", "share", "icons", "iris-extra.png");
                string iconArg = File.Exists(iconPath) ? iconPath : "preferences-system-time";

                var psi = new ProcessStartInfo
                {
                    FileName = "notify-send",
                    ArgumentList = { "-a", "IRIS Extra", "-i", iconArg, title, message },
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process.Start(psi);
            }
            else
            {
                // Windows fallback notification via PowerShell
                string script = $"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; " +
                               $"$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); " +
                               $"$template.GetElementsByTagName('text')[0].AppendChild($template.CreateTextNode('{title.Replace("'", "''")}')) | Out-Null; " +
                               $"$template.GetElementsByTagName('text')[1].AppendChild($template.CreateTextNode('{message.Replace("'", "''")}')) | Out-Null; " +
                               $"$toast = [Windows.UI.Notifications.ToastNotification]::new($template); " +
                               $"[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('IRIS Tracker').Show($toast);";

                Process.Start(new ProcessStartInfo
                {
                    FileName = "powershell",
                    Arguments = $"-NoProfile -Command \"{script}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DesktopIntegration] Notification failed: {ex.Message}");
        }
    }

    public static void ApplyAutostart(bool enable)
    {
        try
        {
            if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                // Linux XDG autostart
                string autostartDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    ".config",
                    "autostart"
                );

                string desktopFilePath = Path.Combine(autostartDir, AutostartDesktopFile);

                if (enable)
                {
                    Directory.CreateDirectory(autostartDir);
                    string? exePath = Environment.ProcessPath;
                    if (string.IsNullOrEmpty(exePath)) return;

                    string content = $@"[Desktop Entry]
Type=Application
Version=1.0
Name=IRIS Extra
GenericName=Game Playtime Tracker
Comment=Automatic game playtime tracker for IRIS
Exec={exePath}
Icon=iris-extra
Terminal=false
Categories=Game;Utility;
Keywords=iris;extra;tracker;playtime;game;
StartupWMClass=IrisExtra
";
                    File.WriteAllText(desktopFilePath, content);
                }
                else
                {
                    if (File.Exists(desktopFilePath))
                    {
                        File.Delete(desktopFilePath);
                    }
                }
            }
            else
            {
                // Windows registry
                // Microsoft.Win32.Registry can be called on Windows
                SetWindowsRegistryAutostart(enable);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DesktopIntegration] Failed to set autostart: {ex.Message}");
        }
    }

    private static void SetWindowsRegistryAutostart(bool enable)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;

        try
        {
            string exePath = Environment.ProcessPath ?? string.Empty;
            if (string.IsNullOrEmpty(exePath)) return;

            string cmd = enable
                ? $"New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'IrisTracker' -Value '\"{exePath}\"' -PropertyType String -Force"
                : $"Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'IrisTracker' -ErrorAction SilentlyContinue";

            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell",
                Arguments = $"-NoProfile -Command \"{cmd}\"",
                CreateNoWindow = true,
                UseShellExecute = false
            });
        }
        catch { }
    }

    public static void OpenDirectory(string directoryPath)
    {
        try
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = directoryPath,
                    UseShellExecute = true
                });
            }
            else
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "xdg-open",
                    ArgumentList = { directoryPath },
                    UseShellExecute = false
                });
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DesktopIntegration] Failed to open folder: {ex.Message}");
        }
    }
}
