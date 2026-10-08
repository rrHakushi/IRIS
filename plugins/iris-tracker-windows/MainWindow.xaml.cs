using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using Hardcodet.Wpf.TaskbarNotification;
using IrisTracker.Models;
using IrisTracker.Services;
using IrisTracker.Views;

namespace IrisTracker;

public partial class MainWindow : Window
{
    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly ProcessTrackerService _tracker;
    private readonly TaskbarIcon _notifyIcon;
    private bool _isExplicitExit;

    public MainWindow(bool startInTray = false)
    {
        InitializeComponent();

        _storage = new StorageService();
        var settings = _storage.LoadSettings();

        string? token = StorageService.UnprotectString(settings.EncryptedToken);
        _api = new IrisApiClient(settings.ApiBaseUrl, token);
        _tracker = new ProcessTrackerService(_storage, _api);

        _notifyIcon = SetupNotifyIcon();
        DarkTitleBarHelper.EnableDarkTitleBar(this);

        Loaded += (s, e) =>
        {
            NavigateToInitialView();
            if (startInTray)
            {
                Hide();
            }
        };

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
        var login = new LoginControl(_api, _storage);
        login.LoggedIn += (user, token) =>
        {
            login.Cleanup();
            ShowTrackerView();
        };

        RootContainer.Children.Clear();
        RootContainer.Children.Add(login);
    }

    private void ShowTrackerView()
    {
        var settings = _storage.LoadSettings();
        _api.BaseUrl = settings.ApiBaseUrl;
        _api.AuthToken = StorageService.UnprotectString(settings.EncryptedToken);
        _tracker.ReloadEntries();

        var tracker = new TrackerControl(_tracker, _api, _storage);
        tracker.LoggedOut += () =>
        {
            ShowLoginView();
        };

        RootContainer.Children.Clear();
        RootContainer.Children.Add(tracker);
    }

    private TaskbarIcon SetupNotifyIcon()
    {
        var icon = new TaskbarIcon
        {
            ToolTipText = "Iris extra",
            Icon = CreateAppIcon()
        };

        var menu = new ContextMenu();

        var openItem = new MenuItem { Header = "Open Iris extra" };
        openItem.Click += (s, e) => RestoreWindow();
        menu.Items.Add(openItem);

        var syncItem = new MenuItem { Header = "Sync Pending Hours" };
        syncItem.Click += async (s, e) => await _tracker.SyncPendingIncrementsAsync();
        menu.Items.Add(syncItem);

        menu.Items.Add(new Separator());

        var exitItem = new MenuItem { Header = "Exit" };
        exitItem.Click += (s, e) =>
        {
            _isExplicitExit = true;
            _tracker.Stop();
            icon.Dispose();
            Close();
            System.Windows.Application.Current.Shutdown();
        };
        menu.Items.Add(exitItem);

        icon.ContextMenu = menu;
        icon.TrayMouseDoubleClick += (s, e) => RestoreWindow();

        return icon;
    }

    private static Icon CreateAppIcon()
    {
        try
        {
            var uri = new Uri("pack://application:,,,/Assets/iris.ico", UriKind.Absolute);
            var streamInfo = System.Windows.Application.GetResourceStream(uri);
            if (streamInfo != null)
            {
                return new Icon(streamInfo.Stream);
            }
        }
        catch { }

        try
        {
            string localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "iris.ico");
            if (File.Exists(localPath))
            {
                return new Icon(localPath);
            }
        }
        catch { }

        return SystemIcons.Application;
    }

    private void RestoreWindow()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void OnWindowClosing(object? sender, CancelEventArgs e)
    {
        if (_isExplicitExit) return;

        var settings = _storage.LoadSettings();
        if (settings.MinimizeToTrayOnClose)
        {
            e.Cancel = true;
            Hide();
        }
        else
        {
            _tracker.Stop();
            _notifyIcon.Dispose();
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        base.OnClosed(e);
        _notifyIcon.Dispose();
    }
}