using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace IrisTracker.Services;

public class WindowInfo
{
    public IntPtr Handle { get; set; }
    public uint ProcessId { get; set; }
    public string ExecutableName { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;
    public string FullPath { get; set; } = string.Empty;

    public string DisplayText => string.IsNullOrWhiteSpace(WindowTitle)
        ? ExecutableName
        : $"{ExecutableName} — \"{WindowTitle}\"";
}

public static class WindowCaptureHelper
{
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool QueryFullProcessImageName(IntPtr hProcess, int dwFlags, StringBuilder lpExeName, ref int lpdwSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out bool pvAttribute, int cbAttribute);

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const int DWMWA_CLOAKED = 14;

    /// <summary>
    /// Returns all visible top-level application windows on the desktop (OBS-style window list).
    /// </summary>
    public static List<WindowInfo> GetActiveWindows()
    {
        var windows = new List<WindowInfo>();
        var seenPids = new HashSet<uint>();

        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd)) return true;

            // Check if window is cloaked (e.g. suspended UWP apps or virtual desktops)
            if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out bool isCloaked, sizeof(bool)) == 0 && isCloaked)
            {
                return true;
            }

            var titleBuilder = new StringBuilder(512);
            GetWindowText(hWnd, titleBuilder, titleBuilder.Capacity);
            var title = titleBuilder.ToString().Trim();

            // Skip common system / internal shells
            if (string.IsNullOrEmpty(title) ||
                title == "Program Manager" ||
                title == "Settings" ||
                title == "Windows Shell Experience Host")
            {
                return true;
            }

            GetWindowThreadProcessId(hWnd, out uint pid);
            if (pid == 0 || pid == (uint)Environment.ProcessId) return true;

            var fullPath = GetProcessPath(pid);
            var exeName = !string.IsNullOrEmpty(fullPath)
                ? Path.GetFileName(fullPath)
                : GetProcessNameFallback(pid);

            if (string.IsNullOrEmpty(exeName)) return true;

            windows.Add(new WindowInfo
            {
                Handle = hWnd,
                ProcessId = pid,
                ExecutableName = exeName,
                WindowTitle = title,
                FullPath = fullPath ?? string.Empty
            });

            return true;
        }, IntPtr.Zero);

        return windows;
    }

    /// <summary>
    /// OBS-style matching logic:
    /// 1. Match specific window title if pattern provided.
    /// 2. If title not found or not specified, match any visible window of the same executable.
    /// 3. If no window, fall back to checking if the process is running.
    /// </summary>
    public static bool IsProcessOrWindowRunning(string executableName, string? windowTitlePattern)
    {
        if (string.IsNullOrWhiteSpace(executableName)) return false;

        var targetExe = NormalizeExeName(executableName);
        var activeWindows = GetActiveWindows();

        // 1. Try matching with window title pattern first if specified
        if (!string.IsNullOrWhiteSpace(windowTitlePattern))
        {
            foreach (var win in activeWindows)
            {
                if (NormalizeExeName(win.ExecutableName).Equals(targetExe, StringComparison.OrdinalIgnoreCase))
                {
                    if (win.WindowTitle.Contains(windowTitlePattern.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
        }

        // 2. If title pattern not found or not provided, match any window of the same executable
        foreach (var win in activeWindows)
        {
            if (NormalizeExeName(win.ExecutableName).Equals(targetExe, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        // 3. Fallback: check if the process is running even without an active top-level window
        try
        {
            var baseName = Path.GetFileNameWithoutExtension(targetExe);
            var processes = Process.GetProcessesByName(baseName);
            if (processes.Length > 0)
            {
                foreach (var p in processes)
                {
                    try
                    {
                        if (!p.HasExited) return true;
                    }
                    catch
                    {
                        return true;
                    }
                }
            }
        }
        catch
        {
            // Process inspection might fail with access denied; ignore
        }

        return false;
    }

    public static string NormalizeExeName(string exeName)
    {
        var clean = Path.GetFileName(exeName.Trim());
        if (!clean.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            clean += ".exe";
        }
        return clean;
    }

    private static string? GetProcessPath(uint pid)
    {
        IntPtr hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (hProcess == IntPtr.Zero) return null;

        try
        {
            var sb = new StringBuilder(1024);
            int size = sb.Capacity;
            if (QueryFullProcessImageName(hProcess, 0, sb, ref size))
            {
                return sb.ToString();
            }
        }
        finally
        {
            CloseHandle(hProcess);
        }

        return null;
    }

    private static string GetProcessNameFallback(uint pid)
    {
        try
        {
            using var proc = Process.GetProcessById((int)pid);
            return $"{proc.ProcessName}.exe";
        }
        catch
        {
            return string.Empty;
        }
    }
}
