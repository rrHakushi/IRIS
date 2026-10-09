using System;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using IrisTracker.Models;
using IrisTracker.Services;
using IrisTracker.Views;

namespace IrisTracker;

public partial class MainWindow : Window
{
    public static MainWindow? Instance { get; private set; }

    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly ProcessTrackerService _tracker;

    public ProcessTrackerService Tracker => _tracker;

    public MainWindow()
    {
        InitializeComponent();
        Instance = this;

        _storage = new StorageService();
        var settings = _storage.LoadSettings();

        string? token = StorageService.UnprotectString(settings.EncryptedToken);
        _api = new IrisApiClient(settings.ApiBaseUrl, token);
        _tracker = new ProcessTrackerService(_storage, _api);

        DesktopIntegration.EnsureLinuxDesktopIntegration();

        Opened += (s, e) => NavigateToInitialView();
        Closing += OnWindowClosing;
    }

    private void NavigateToInitialView()
    {
        var settings = _storage.LoadSettings();
        string? token = StorageService.UnprotectString(settings.EncryptedToken);

        if (!string.IsNullOrEmpty(token) && !string.IsNullOrEmpty(settings.Username))
        {
            ShowTrackerView();
        }
        else
        {
            ShowLoginView();
        }
    }

    private void ShowLoginView()
    {
        var login = new LoginView(_api, _storage);
        login.LoggedIn += (user, token) =>
        {
            login.Cleanup();
            ShowTrackerView();
        };

        RootContainer.Content = login;
    }

    private void ShowTrackerView()
    {
        var settings = _storage.LoadSettings();
        _api.BaseUrl = settings.ApiBaseUrl;
        _api.AuthToken = StorageService.UnprotectString(settings.EncryptedToken);
        _tracker.ReloadEntries();

        var tracker = new TrackerView(_tracker, _api, _storage);
        tracker.LoggedOut += () =>
        {
            ShowLoginView();
        };

        RootContainer.Content = tracker;
    }

    public void ExitApp()
    {
        _tracker.Stop();
        Close();
    }

    private void OnWindowClosing(object? sender, WindowClosingEventArgs e)
    {
        _tracker.Stop();
    }
}
