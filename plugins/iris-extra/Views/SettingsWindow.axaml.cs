using System;
using System.IO;
using Avalonia.Controls;
using Avalonia.Interactivity;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class SettingsWindow : Window
{
    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly AppSettings _settings;

    public SettingsWindow() : this(new StorageService(), new IrisApiClient())
    {
    }

    public SettingsWindow(StorageService storage, IrisApiClient api)
    {
        InitializeComponent();
        _storage = storage;
        _api = api;
        _settings = _storage.LoadSettings();

        TxtApiUrl.Text = _settings.ApiBaseUrl;
        ChkNotify.IsChecked = _settings.NotifyOnHourIncrement;
        ChkStartOnStartup.IsChecked = _settings.StartOnStartup;
    }

    private void BtnCancel_Click(object? sender, RoutedEventArgs e)
    {
        Close();
    }

    private void BtnOpenDataFolder_Click(object? sender, RoutedEventArgs e)
    {
        try
        {
            var dir = _storage.BaseDirectory;
            if (Directory.Exists(dir))
            {
                DesktopIntegration.OpenDirectory(dir);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Settings] Failed to open folder: {ex.Message}");
        }
    }

    private void BtnResetData_Click(object? sender, RoutedEventArgs e)
    {
        _storage.ResetAllData();
        DesktopIntegration.ShowNotification("IRIS Tracker", "All local data has been reset.");
        Close();
    }

    private void BtnSave_Click(object? sender, RoutedEventArgs e)
    {
        var newUrl = TxtApiUrl.Text?.Trim() ?? string.Empty;
        if (!string.IsNullOrEmpty(newUrl))
        {
            _settings.ApiBaseUrl = newUrl;
            _api.BaseUrl = newUrl;
        }

        _settings.NotifyOnHourIncrement = ChkNotify.IsChecked ?? true;
        _settings.StartOnStartup = ChkStartOnStartup.IsChecked ?? false;

        DesktopIntegration.ApplyAutostart(_settings.StartOnStartup);

        _storage.SaveSettings(_settings);
        Close();
    }
}
