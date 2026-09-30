using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace IrisTracker.Services;

public static class DarkTitleBarHelper
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public static void EnableDarkTitleBar(Window window)
    {
        if (window.IsLoaded)
        {
            Apply(window);
        }
        else
        {
            window.Loaded += (s, e) => Apply(window);
        }
    }

    private static void Apply(Window window)
    {
        try
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            if (hwnd == IntPtr.Zero) return;

            int useDarkMode = 1;
            int result = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref useDarkMode, sizeof(int));
            if (result != 0)
            {
                // Fallback for older Windows 10 versions
                DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ref useDarkMode, sizeof(int));
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DarkTitleBar] Failed to enable dark title bar: {ex.Message}");
        }
    }
}
