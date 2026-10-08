using System;
using System.IO;
using System.Windows;
using IrisTracker.Models;
using IrisTracker.Services;
using Microsoft.Win32;

namespace IrisTracker.Views;

public partial class SettingsWindow : Window
{
    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly AppSettings _settings;

    private const string RunRegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string AppName = "IrisExtra";

    public SettingsWindow(StorageService storage, IrisApiClient api)
    {
        InitializeComponent();
        _storage = storage;
        _api = api;
        _settings = _storage.LoadSettings();
        DarkTitleBarHelper.EnableDarkTitleBar(this);

        TxtApiUrl.Text = _settings.ApiBaseUrl;
        ChkStartInTray.IsChecked = _settings.StartInTray;
        ChkMinimizeToTray.IsChecked = _settings.MinimizeToTrayOnClose;
        ChkStartWithWindows.IsChecked = _settings.StartWithWindows;
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void BtnOpenDataFolder_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            var dir = _storage.BaseDirectory;
            if (Directory.Exists(dir))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = dir,
                    UseShellExecute = true
                });
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Failed to open folder: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void BtnResetData_Click(object sender, RoutedEventArgs e)
    {
        var res = MessageBox.Show(
            this,
            "Are you sure you want to reset all data?\n\nThis will remove your saved login credentials, API settings, and all linked games.",
            "Confirm Data Reset",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning
        );

        if (res == MessageBoxResult.Yes)
        {
            _storage.ResetAllData();
            MessageBox.Show(
                this,
                "All local data has been reset.\n\nThe application will now close. Please restart it to start fresh.",
                "Data Reset Complete",
                MessageBoxButton.OK,
                MessageBoxImage.Information
            );

            System.Windows.Application.Current.Shutdown();
        }
    }

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        var newUrl = TxtApiUrl.Text.Trim();
        if (!string.IsNullOrEmpty(newUrl))
        {
            _settings.ApiBaseUrl = newUrl;
            _api.BaseUrl = newUrl;
        }

        _settings.StartInTray = ChkStartInTray.IsChecked ?? false;
        _settings.MinimizeToTrayOnClose = ChkMinimizeToTray.IsChecked ?? true;
        _settings.StartWithWindows = ChkStartWithWindows.IsChecked ?? false;

        ApplyStartupRegistry(_settings.StartWithWindows, _settings.StartInTray);

        _storage.SaveSettings(_settings);
        Close();
    }

    private void ApplyStartupRegistry(bool startWithWindows, bool startInTray)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunRegistryKey, true);
            if (key == null) return;

            // Also clean up legacy key name if it exists
            try { key.DeleteValue("IrisTracker", false); } catch { }

            if (startWithWindows)
            {
                var exePath = Environment.ProcessPath;
                if (!string.IsNullOrEmpty(exePath))
                {
                    string cmd = startInTray ? $"\"{exePath}\" --tray" : $"\"{exePath}\"";
                    key.SetValue(AppName, cmd);
                }
            }
            else
            {
                key.DeleteValue(AppName, false);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Settings] Failed to set registry startup: {ex.Message}");
        }
    }
}
